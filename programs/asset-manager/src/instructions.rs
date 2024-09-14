use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::{self, spl_token, TokenAccount, Transfer};

use std::str::FromStr;
use xcall::cpi::accounts::{SendCallCtx, HandleForcedRollbackCtx};
use xcall_lib::message::{
    call_message_rollback::CallMessageWithRollback, envelope::Envelope, AnyMessage,
};
use xcall_lib::network_address::NetworkAddress;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;
use xcall_manager::{cpi::accounts::VerifyProtocols, program::XcallManager, XmState};

use crate::errors::AssetManagerError;
use crate::helpers::{
    decode_deposit_revert_msg, decode_method, decode_token_address, decode_withdraw_to_msg,
};
use crate::{
    param_accounts::*,
    states::*,
    structs::{deposit_message::*, deposit_revert::*, withdraw_message::*},
};

const POINTS: u64 = 10000;
pub const _NATIVE_ADDRESS: &str = "11111111111111111111111111111111";

pub fn initialize(
    ctx: Context<Initialize>,
    xcall: Pubkey,
    icon_asset_manager: String,
    xcall_manager: Pubkey,
    xcall_manager_state: Pubkey,
) -> Result<()> {
    let state: &mut Account<State> = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_asset_manager = icon_asset_manager;
    state.xcall_manager = xcall_manager;
    state.xcall_manager_state = xcall_manager_state;
    state.admin = ctx.accounts.admin.key();
    Ok(())
}

pub fn set_admin(
    ctx: Context<SetAdmin>,
    admin: Pubkey) -> Result<()>{
    let state: &mut Account<State> = &mut ctx.accounts.state;
    state.admin = admin;
    return  Ok(());
}

pub fn configure_rate_limit(
    ctx: Context<ConfigureRateLimit>,
    token: Pubkey,
    period: u64,
    percentage: u64,
) -> Result<()> {
    require!(percentage <= POINTS, AssetManagerError::PercentageTooHigh);

    let token_state: &mut Account<TokenState> = &mut ctx.accounts.token_state;
    let current_limit = 0;
    let last_update = Clock::get()?.unix_timestamp;
    token_state.set_inner(TokenState {
        token,
        period,
        percentage,
        last_update,
        current_limit,
    });
    Ok(())
}

fn calculate_limit(token_state: &TokenState, balance: u64) -> Result<u64> {
    let period = token_state.period;
    let percentage = token_state.percentage;
    if period == 0 {
        return Ok(0);
    }

    let max_limit = (balance * percentage) / 10000;
    let max_withdraw = balance.saturating_sub(max_limit);
    let time_diff = Clock::get()?
        .unix_timestamp
        .saturating_sub(token_state.last_update);
    let min_time_diff = std::cmp::min(time_diff as u64, period);

    let added_allowed_withdrawal = (max_withdraw * min_time_diff) / period;
    let limit = token_state
        .current_limit
        .saturating_sub(added_allowed_withdrawal);
    let min_limit = std::cmp::min(balance, limit);

    Ok(std::cmp::max(min_limit, max_limit))
}

pub fn get_withdraw_limit(ctx: Context<GetWithdrawLimit>) -> Result<u64> {
    let token_state = &ctx.accounts.token_state;
    let balance = balance_of(&ctx.accounts.vault_token_account)?;
    calculate_limit(token_state, balance)
}

pub fn deposit_token<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositToken<'info>>,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    require!(amount > 0, AssetManagerError::InvalidAmount);
    let from = ctx
        .accounts
        .from
        .as_ref()
        .ok_or(AssetManagerError::InvalidFromAddress)?;
    let vault_token_account = ctx
        .accounts
        .vault_token_account
        .as_ref()
        .ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;

    let cpi_accounts = Transfer {
        from: from.to_account_info(),
        to: vault_token_account.to_account_info(),
        authority: ctx.accounts.from_authority.to_account_info(),
    };
    let cpi_program = ctx
        .accounts
        .token_program
        .as_ref()
        .ok_or(AssetManagerError::InvalidProgram)?
        .to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let token_addr = from.mint.to_string();
    let from: Pubkey = from.key();
    let res = send_deposit_message(ctx, token_addr, from.key(), amount, to, data)?;
    Ok(res)
}

pub fn deposit_native<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositToken<'info>>,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    require!(amount > 0, AssetManagerError::InvalidAmount);
    let vault_native_account = ctx
        .accounts
        .vault_native_account
        .as_ref()
        .ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let user = &ctx.accounts.from_authority;

    let transfer_instruction = spl_token::solana_program::system_instruction::transfer(
        &user.key(),
        &vault_native_account.key(),
        amount,
    );
    spl_token::solana_program::program::invoke(
        &transfer_instruction,
        &[
            user.to_account_info(),
            vault_native_account.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;
    let from: Pubkey = user.key();
    let res = send_deposit_message(
        ctx,
        String::from_str(_NATIVE_ADDRESS).unwrap(),
        from,
        amount,
        to,
        data,
    )?;
    Ok(res)
}

fn send_deposit_message<'info>(
    ctx: Context<'_, '_, '_, 'info, DepositToken<'info>>,
    token_address: String,
    from: Pubkey,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    let deposit_message = DepositMessage::create(
        token_address.clone(),
        from.to_string(),
        to.unwrap_or("".to_string()),
        amount,
        data.unwrap_or(vec![]),
    );
    let data = rlp::encode(&deposit_message).to_vec();
    let rollback = rlp::encode(&DepositRevert::create(
        token_address,
        from.to_string(),
        amount,
    ))
    .to_vec();

    let sources = &ctx.accounts.xcall_manager_state.sources;
    let destinations = &ctx.accounts.xcall_manager_state.destinations;
    let message = AnyMessage::CallMessageWithRollback(CallMessageWithRollback { data, rollback });
    let envelope: Envelope = Envelope::new(message, sources.clone(), destinations.clone());
    let envelope_encoded = rlp::encode(&envelope).to_vec();

    let icon_asset_manager =
        NetworkAddress::from_str(&ctx.accounts.state.icon_asset_manager).unwrap(); //todo: get network address without unwrap

    let xcall_config = &ctx.remaining_accounts[0];
    let rollback_account = &ctx.remaining_accounts[1];
    let sysvar_account = &ctx.remaining_accounts[2];
    let fee_handler = &ctx.remaining_accounts[3];
    let from_authority = &ctx.accounts.from_authority;
    let xcall_authority = &ctx.accounts.xcall_authority;
    // the accounts for centralized connections is contained here.
    let remaining_accounts: &[AccountInfo<'info>] = ctx.remaining_accounts.split_at(4).1;
    let bump = ctx.bumps.xcall_authority;
    let seeds = &[Authority::SEED_PREFIX.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts: SendCallCtx = SendCallCtx {
        config: xcall_config.to_account_info(),
        rollback_account: Some(rollback_account.to_account_info()),
        fee_handler: fee_handler.to_account_info(),
        signer: from_authority.to_account_info(),
        instruction_sysvar: sysvar_account.to_account_info(),
        dapp_authority: Some(xcall_authority.to_account_info()),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(xcall_program, cpi_accounts, signer_seeds)
        .with_remaining_accounts(remaining_accounts.to_vec());
    let result = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_asset_manager)?;
    Ok(result.get())
}

pub fn verify_protocols<'info>(
    xcall_manager_program: Program<'info, XcallManager>,
    xm_state: Account<'info, XmState>,
    protocols: &[String],
) -> Result<bool> {
    let cpi_accounts: VerifyProtocols = VerifyProtocols {
        state: xm_state.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(xcall_manager_program.to_account_info(), cpi_accounts);
    let verified = xcall_manager::cpi::verify_protocols(cpi_ctx, protocols.to_vec())?;
    Ok(verified.get())
}

pub fn get_handle_call_message_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    data: Vec<u8>,
) -> Result<ParamAccounts> {
    let token_address = decode_token_address(&data)?;
    let method = decode_method(&data)?;
    if token_address != _NATIVE_ADDRESS.to_string() && method == WITHDRAW_TO {
        Ok(ParamAccounts {
            accounts: get_spl_token_withdraw_to_accounts(ctx, data)?,
        })
    } else if token_address != _NATIVE_ADDRESS && method == DEPOSIT_REVERT {
        Ok(ParamAccounts {
            accounts: get_spl_token_deposit_revert_accounts(ctx, data)?,
        })
    } else if token_address == _NATIVE_ADDRESS && method == WITHDRAW_TO_NATIVE {
        Ok(ParamAccounts {
            accounts: get_native_token_withdraw_to_accounts(ctx, data)?,
        })
    } else if token_address == _NATIVE_ADDRESS && method == DEPOSIT_REVERT {
        Ok(ParamAccounts {
            accounts: get_native_token_deposit_revert_accounts(ctx, data)?,
        })
    } else {
        let accounts: Vec<ParamAccountProps> = vec![];
        Ok(ParamAccounts { accounts })
    }
}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>,
) -> Result<HandleCallMessageResponse> {
    require!(
        verify_protocols(
            ctx.accounts.xcall_manager.clone(),
            ctx.accounts.xcall_manager_state.clone(),
            &protocols
        )?,
        AssetManagerError::ProtocolMismatch
    );

    let token_address = decode_token_address(&data)?;
    let result;
    if token_address != _NATIVE_ADDRESS.to_string() {
        result = handle_token_call_message(ctx, from, data);
    } else {
        result = handle_native_call_message(ctx, from, data);
    }

    match result {
        Ok(value) => {
            return Ok(HandleCallMessageResponse {
                success: value,
                message: "Success".to_owned(),
            });
        }
        Err(e) => {
            return Ok(HandleCallMessageResponse {
                success: false,
                message: e.to_string(),
            });
        }
    }
}

fn handle_token_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
) -> Result<bool> {
    let state = ctx.accounts.state.clone();
    let bump = ctx.bumps.valult_authority.unwrap();
    let method = decode_method(&data)?;
    let to: &Account<'info, TokenAccount> = ctx
        .accounts
        .to
        .as_ref()
        .ok_or(AssetManagerError::InvalidToAddress)?;
    let mint = ctx
        .accounts
        .mint
        .as_ref()
        .ok_or(AssetManagerError::MintIsRequired)?;
    let token_program = ctx
        .accounts
        .token_program
        .as_ref()
        .ok_or(AssetManagerError::TokenProgramIsRequired)?;
    let vault_token_account = ctx
        .accounts
        .vault_token_account
        .as_ref()
        .ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let vault_authority = ctx
        .accounts
        .valult_authority
        .as_ref()
        .ok_or(AssetManagerError::ValultAuthorityIsRequired)?;
    let mut token_state: &mut Account<'info, TokenState> = &mut ctx.accounts.token_state;
    if method == WITHDRAW_TO {
        if from != state.icon_asset_manager{
           return Err(AssetManagerError::NotIconAssetManager.into())
        }
        let message = decode_withdraw_to_msg(&data)?;
        let token_pubkey = Pubkey::from_str(&message.token_address)
            .map_err(|_| AssetManagerError::NotAnAddress)?;
        let recipient_pubkey =
            Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
        if recipient_pubkey != to.key() {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        if token_pubkey != mint.key() {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        withdraw_token(
            &mut token_state,
            vault_token_account.to_account_info(),
            to.to_account_info(),
            message.amount as u64,
            mint.key(),
            token_program.to_account_info(),
            vault_authority.clone(),
            bump,
        )?;
    } else if method == DEPOSIT_REVERT {
        let from_network_address = NetworkAddress::from_str(&from)?;
        if from_network_address.account() != state.xcall.to_string() {
            return Err(AssetManagerError::UnauthorizedCaller.into())
        }

        let message = decode_deposit_revert_msg(&data)?;
        let recipient_pubkey =
            Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
        if recipient_pubkey != to.key() {
           return Err(AssetManagerError::InvalidToAddress.into())
        }
        let token_pubkey = Pubkey::from_str(&message.token_address)
            .map_err(|_| AssetManagerError::NotAnAddress)?;
        if token_pubkey != mint.key() {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        
        withdraw_token(
            &mut token_state,
            vault_token_account.to_account_info(),
            to.to_account_info(),
            message.amount as u64,
            mint.key(),
            token_program.to_account_info(),
            vault_authority.clone(),
            bump,
        )?;
    } else {
        return Err(AssetManagerError::UnknownMessage.into());
    }

    Ok(true)
}

fn handle_native_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>
) -> Result<bool> {
    
    let state = ctx.accounts.state.clone();
    let bump = ctx.bumps.vault_native_account.unwrap();
    let method = decode_method(&data)?;
    let to_native = ctx
        .accounts
        .to_native
        .as_ref()
        .ok_or(AssetManagerError::InvalidToAddress)?;
    let vault_native_account = ctx
        .accounts
        .vault_native_account
        .as_ref()
        .ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let system_program_info = ctx.accounts.system_program.to_account_info();
    let mut token_state = &mut ctx.accounts.token_state;
    if method == WITHDRAW_TO_NATIVE {
        if from != state.icon_asset_manager {
            return Err(AssetManagerError::NotIconAssetManager.into())
        }
        let message = decode_withdraw_to_msg(&data)?;
        let recipient_pubkey =
            Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
        if recipient_pubkey != to_native.key() {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        if message.token_address != _NATIVE_ADDRESS {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        withdraw_native_token(
            &mut token_state,
            vault_native_account.clone(),
            to_native.clone(),
            system_program_info,
            message.amount as u64,
            bump,
        )?;
    } else if method == DEPOSIT_REVERT {
        let from_network_address = NetworkAddress::from_str(&from)?;
        if from_network_address.account() != state.xcall.to_string() {
           return Err(AssetManagerError::NotIconAssetManager.into())
        }
        let message = decode_deposit_revert_msg(&data)?;
        let recipient_pubkey =
            Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
        if recipient_pubkey != to_native.key() {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        if message.token_address != _NATIVE_ADDRESS {
            return Err(AssetManagerError::InvalidToAddress.into())
        }
        withdraw_native_token(
            &mut token_state,
            vault_native_account.clone(),
            to_native.clone(),
            system_program_info,
            message.amount as u64,
            bump,
        )?;
    } else {
        return Err(AssetManagerError::UnknownMessage.into());
    }

    Ok(true)
}

fn withdraw_token<'info>(
    token_state: &mut Account<TokenState>,
    vault_token_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    amount: u64,
    mint: Pubkey,
    token_program: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    bump: u8,
) -> Result<()> {
    let account_data = spl_token::state::Account::unpack(&vault_token_account.data.borrow_mut())?;
    let vault_balance = account_data.amount;

    if vault_balance < amount {
        return Err(AssetManagerError::InsufficientBalance.into())
    }
    let _ = verify_withdraw(token_state, amount, vault_balance);

    let cpi_accounts = Transfer {
        from: vault_token_account,
        to: recipient,
        authority,
    };
    let mint_bytes = mint.to_bytes();
    let seeds = &[b"vault".as_ref(), mint_bytes.as_ref(), &[bump]];
    let signer = &[&seeds[..]];
    token::transfer(
        CpiContext::new_with_signer(token_program, cpi_accounts, signer),
        amount,
    )?;
    Ok(())
}

fn withdraw_native_token<'info>(
    token_state: &mut Account<TokenState>,
    vault_native_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    amount: u64,
    bump: u8,
) -> Result<()> {
    if amount > **vault_native_account.try_borrow_lamports()? {
        return Err(AssetManagerError::InsufficientBalance.into())
    }
    let _ = verify_withdraw(token_state, amount, vault_native_account.get_lamports());

    let seeds: &[&[u8]; 2] = &[b"vault_native".as_ref(), &[bump]];
    let signer = &[&seeds[..]];

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &vault_native_account.key,
        &recipient.key,
        amount,
    );

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[vault_native_account, recipient, system_program],
        signer,
    )?;

    Ok(())
}

pub fn verify_withdraw(token_state: &mut TokenState, amount: u64, balance: u64) -> Result<()> {
    let limit = calculate_limit(&token_state, balance)?;
    if balance.saturating_sub(amount) < limit {
       return Err(AssetManagerError::ExceedsWithdrawLimit.into())
    }

    token_state.current_limit = limit;
    token_state.last_update = Clock::get()?.unix_timestamp;

    Ok(())
}

pub fn force_rollback<'info>(
    ctx: Context<'_, '_, '_, 'info, ForceRollback<'info>>,
    request_id: u128,
)->Result<()> {
    let bump = ctx.bumps.xcall_authority;
    let seeds = &[Authority::SEED_PREFIX.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];

    let proxy_request = &ctx.remaining_accounts[0];
    let config = &ctx.remaining_accounts[1];
    let admin = &ctx.remaining_accounts[2];

    let remaining_accounts: &[AccountInfo<'info>] = ctx.remaining_accounts.split_at(3).1;
    let cpi_accounts: HandleForcedRollbackCtx =  HandleForcedRollbackCtx{
        proxy_request: proxy_request.to_account_info(),
        signer: ctx.accounts.signer.to_account_info(),
        dapp_authority: ctx.accounts.xcall_authority.to_account_info(),
        config: config.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        admin: admin.to_account_info()
    };

    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(xcall_program, cpi_accounts, signer_seeds)
    .with_remaining_accounts(remaining_accounts.to_vec());
        
    let _result = xcall::cpi::handle_forced_rollback(cpi_ctx, request_id)?;
    Ok(())
}

fn balance_of(account: &Account<TokenAccount>) -> Result<u64> {
    Ok(account.amount)
}

