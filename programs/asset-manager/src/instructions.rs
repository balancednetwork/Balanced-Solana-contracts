use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_spl::token::{
        self, spl_token, TokenAccount, Transfer
    };

use xcall_manager::{XmState, program::XcallManager, cpi::accounts::VerifyProtocols};
use xcall::cpi::accounts::SendCallCtx;
use xcall_lib::message::{AnyMessage, call_message_rollback::CallMessageWithRollback, envelope::Envelope};
use xcall_lib::network_address::NetworkAddress;
use std::str::FromStr;

use crate::errors::AssetManagerError;
use crate::helpers::{decode_deposit_revert_msg, decode_method, decode_token_address, decode_withdraw_to_msg };
use crate::{states::*, param_accounts::*, structs::{
        deposit_message::*,
        withdraw_message::*,
        deposit_revert::*,
        
    }
};

const POINTS: u64 = 10000;
const _NATIVE_ADDRESS: &str = "11111111111111111111111111111111";

pub fn initialize(
    ctx: Context<Initialize>,
    xcall: Pubkey,
    icon_asset_manager: String,
    xcall_manager: Pubkey,
    xcall_manager_state: Pubkey
) -> Result<()> {
    let state: &mut Account<State> = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_asset_manager = icon_asset_manager;
    state.xcall_manager = xcall_manager;
    state.xcall_manager_state = xcall_manager_state;
    state.admin = ctx.accounts.admin.key();
    Ok(())
}

pub fn configure_rate_limit(
    ctx: Context<ConfigureRateLimit>,
    token: Pubkey,
    period: u64,
    percentage: u64,
) -> Result<()> {
    require!(percentage <= POINTS, AssetManagerError::PercentageTooHigh);

     let token_state = &mut ctx.accounts.token_state;
     let current_limit = 0;
     let last_update = Clock::get()?.unix_timestamp;
     token_state.set_inner(TokenState{token, period, percentage, last_update, current_limit });
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
    let time_diff = Clock::get()?.unix_timestamp.saturating_sub(token_state.last_update);
    let min_time_diff = std::cmp::min(time_diff as u64, period);

    let added_allowed_withdrawal = (max_withdraw * min_time_diff) / period;
    let limit = token_state.current_limit.saturating_sub(added_allowed_withdrawal);
    let min_limit = std::cmp::min(balance, limit);

    Ok(std::cmp::max(min_limit, max_limit))
}

pub fn get_withdraw_limit(ctx: Context<GetWithdrawLimit>) -> Result<u64> {
    let state = &ctx.accounts.token_state;
    let balance = balance_of(&ctx.accounts.vault_token_account)?;
    calculate_limit(state, balance)
}

pub fn deposit_token<'info>(
    ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    let from  = ctx.accounts.from.as_ref().ok_or(AssetManagerError::InvalidFromAddress)?;
    let vault_token_account  = ctx.accounts.vault_token_account.as_ref().ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let cpi_accounts = Transfer {
        from: from.to_account_info(),
        to: vault_token_account.to_account_info(),
        authority: ctx.accounts.from_authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.clone().unwrap().to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let token_addr = ctx.accounts.token_program.clone().unwrap().key().to_string();
    let from: Pubkey = from.key();
    let res = send_deposit_message(
        ctx,
        token_addr,
        from,
        amount,
        to,
        data
    )?;
    Ok(res)
}

pub fn deposit_native<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>, amount: u64, to: Option<String>, data: Option<Vec<u8>>) -> Result<u128> {
    require!(amount > 0, AssetManagerError::InvalidAmount);
    let vault_native_account = ctx.accounts.vault_native_account.as_ref().ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
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
    let res = send_deposit_message(ctx, String::from_str(_NATIVE_ADDRESS).unwrap(), from, amount, to, data)?;
    Ok(res)
}

fn send_deposit_message<'info>(
    ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>,
    token_address: String,
    from: Pubkey,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    let asset_manager = &ctx.accounts.asset_manager;
    let (signer_pda, _bump) = Pubkey::find_program_address(&[b"asset_manager_signer"], &ctx.program_id);
    require!(asset_manager.key() == signer_pda, AssetManagerError::NotAssetManager);

    let deposit_message = DepositMessage::create(
        token_address.clone(),
        from.to_string(),
        to.unwrap_or("".to_string()),
        amount,
        data.unwrap_or(vec![]),
    );

    let data = deposit_message.encode();
    let deposit_revert = DepositRevert::create(token_address, from.to_string(), amount);

    let rollback: Vec<u8> = deposit_revert.encode();
    let sources = &ctx.accounts.xcall_manager_state.sources;
    let destinations = &ctx.accounts.xcall_manager_state.destinations;
    let message = AnyMessage::CallMessageWithRollback(CallMessageWithRollback { data, rollback });
    let envelope: Envelope = Envelope::new(message, sources.clone(), destinations.clone());
    let envelope_encoded = rlp::encode(&envelope).to_vec();
    let icon_asset_manager = NetworkAddress::from_str(&ctx.accounts.state.icon_asset_manager).unwrap(); //todo: get network address without unwrap
    
    let xcall_config = &ctx.remaining_accounts[0];
    let rollback_account = &ctx.remaining_accounts[1];
    let fee_handler = &ctx.remaining_accounts[2];
    let from_authority = &ctx.accounts.from_authority;
    let bump = ctx.bumps.asset_manager;
    let seeds = &[
        b"asset_manager_signer".as_ref(),
        &[bump],
    ];
    let signer_seends = &[&seeds[..]];
    // the accounts for centralized connections is contained here.
    let remaining_accounts = ctx.remaining_accounts.split_at(3).1;
    let cpi_accounts: SendCallCtx = SendCallCtx {
        config: xcall_config.to_account_info(),
        rollback_account: Some(rollback_account.to_account_info()),
        fee_handler: fee_handler.to_account_info(),
        signer: from_authority.to_account_info(),
        dapp: Some(asset_manager.clone()),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(xcall_program, cpi_accounts, signer_seends).with_remaining_accounts(remaining_accounts.to_vec());
    let result = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_asset_manager)?;
    Ok(result.get())
    
}

pub fn verify_protocols<'info>(
    xcall_manager_program: Program<'info, XcallManager>,
    xm_state: Account<'info, XmState>,
    protocols: &[String]
) -> Result<bool> {
    let cpi_accounts: VerifyProtocols = VerifyProtocols {
        state: xm_state.to_account_info()
    };

    let cpi_ctx  = CpiContext::new(xcall_manager_program.to_account_info(), cpi_accounts);
    let _ = xcall_manager::cpi::verify_protocols(cpi_ctx, protocols.to_vec())?;
    Ok(true)
}

pub fn get_handle_call_message_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<ParamAccounts>{
    let token_address = decode_token_address(&data).unwrap();
    let method = decode_method(&data).unwrap();
    if token_address !=_NATIVE_ADDRESS.to_string() && method == WITHDRAW_TO  {
        Ok(ParamAccounts{
            accounts: get_spl_token_withdra_to_accounts(ctx, data)?
        })
    } else if token_address != _NATIVE_ADDRESS && method == DEPOSIT_REVERT {
        Ok(ParamAccounts{
            accounts: get_spl_token_deposit_revert_accounts(ctx, data)?
        })
    } else if token_address == _NATIVE_ADDRESS && method == WITHDRAW_TO {
        Ok(ParamAccounts{
            accounts: get_native_token_withdra_to_accounts(ctx, data)?
        })
    } else if token_address == _NATIVE_ADDRESS && method == DEPOSIT_REVERT {
        Ok(ParamAccounts{
            accounts: get_spl_token_withdra_to_accounts(ctx, data)?
        })
    } else {
        let accounts: Vec<ParamAccountProps> = vec![];
        Ok(ParamAccounts{
            accounts
        })
    }
}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>
) -> Result<()> {
    let token_address = decode_token_address(&data).unwrap();
    if  token_address != _NATIVE_ADDRESS.to_string() {
        return  handle_token_call_message(ctx, from, data, protocols);
    }else {
        return handle_native_call_message(ctx, from, data, protocols);
    }
}

fn handle_token_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>
) -> Result<()> {
    let state = ctx.accounts.state.clone();
    let bump = ctx.bumps.valult_authority.unwrap();

    require!(
        verify_protocols(ctx.accounts.xcall_manager.clone(), ctx.accounts.xcall_manager_state.clone(), &protocols)?,
        AssetManagerError::ProtocolMismatch
    );
    let method = decode_method(&data).unwrap();
    let to  = ctx.accounts.to.as_ref().ok_or(AssetManagerError::InvalidToAddress)?;
    let mint  = ctx.accounts.mint.as_ref().ok_or(AssetManagerError::MintIsRequired)?;
    let token_program  = ctx.accounts.token_program.as_ref().ok_or(AssetManagerError::TokenProgramIsRequired)?;
    let vault_token_account = ctx.accounts.vault_token_account.as_ref().ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let vault_authority = ctx.accounts.valult_authority.as_ref().ok_or(AssetManagerError::ValultAuthorityIsRequired)?;
    if method == WITHDRAW_TO {
        require!(from == state.icon_asset_manager, AssetManagerError::NotIconAssetManager);
        let  message  = decode_withdraw_to_msg(&data).unwrap();
        let token_pubkey = Pubkey::from_str(&message.token_address).map_err(|_| AssetManagerError::NotAnAddress)?;
        let recipient_pubkey = Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
        require!(recipient_pubkey==to.key(), AssetManagerError::InvalidToAddress);
        require!(token_pubkey==mint.key(), AssetManagerError::InvalidToAddress);
        withdraw_token(
            vault_token_account.to_account_info(),
            to.to_account_info(),
            message.amount as u64,
            mint.key(),
            token_program.to_account_info(),
            vault_authority.clone(), bump
        )?;

    } else if method == DEPOSIT_REVERT {
        require!(from == state.xcall.key().to_string(), AssetManagerError::UnauthorizedCaller);

        let  message  = decode_deposit_revert_msg(&data).unwrap();
        let recipient_pubkey = Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
        require!(recipient_pubkey==to.key(), AssetManagerError::InvalidToAddress);
        
        msg!("from the deposit revert");
        withdraw_token(
            vault_token_account.to_account_info(),
            to.to_account_info(),
            message.amount as u64,
            mint.key(),
            token_program.to_account_info(),
            vault_authority.clone(), bump
        )?;
        
    } else {
        msg!("on unknown message");
        return Err(AssetManagerError::UnknownMessage.into());
    }

    Ok(())
}

fn handle_native_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>
) -> Result<()> {
    let state = ctx.accounts.state.clone();

    require!(
        verify_protocols(ctx.accounts.xcall_manager.clone(), ctx.accounts.xcall_manager_state.clone(), &protocols)?,
        AssetManagerError::ProtocolMismatch
    );
    let bump = ctx.bumps.vault_native_account.unwrap();
    let method = decode_method(&data).unwrap();
    let to_native  = ctx.accounts.to_native.as_ref().ok_or(AssetManagerError::InvalidToAddress)?;
    let vault_native_account  = ctx.accounts.vault_native_account.as_ref().ok_or(AssetManagerError::ValultTokenAccountIsRequired)?;
    let system_program_info = ctx.accounts.system_program.to_account_info();
    if method == WITHDRAW_TO_NATIVE {
        require!(from == state.icon_asset_manager, AssetManagerError::NotIconAssetManager);
        let  message  = decode_withdraw_to_msg(&data).unwrap();
        let recipient_pubkey = Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
        require!(recipient_pubkey==to_native.key(), AssetManagerError::InvalidToAddress);
        require!(message.token_address==_NATIVE_ADDRESS, AssetManagerError::InvalidToAddress);
        withdraw_native_token(
            vault_native_account.clone(),
            to_native.clone(),
            system_program_info,
            message.amount as u64, bump
        )?;

    } else if method == DEPOSIT_REVERT {
        require!(from == state.xcall.key().to_string(), AssetManagerError::NotIconAssetManager);
        let  message  = decode_deposit_revert_msg(&data).unwrap();
        let recipient_pubkey = Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
        require!(recipient_pubkey==to_native.key(), AssetManagerError::InvalidToAddress);
        withdraw_native_token(
            vault_native_account.clone(),
            to_native.clone(),
            system_program_info,
            message.amount as u64, bump

        )?;
    } else {
        msg!("on unknown message");
        return Err(AssetManagerError::UnknownMessage.into());
    }

    Ok(())
}

fn withdraw_token<'info>(
    vault_token_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    amount: u64,
    mint: Pubkey,
    token_program: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    bump: u8
) -> Result<()> {
    let account_data = spl_token::state::Account::unpack(&vault_token_account.data.borrow_mut())?;
    let vault_balance = account_data.amount;
    
    require!(vault_balance >= amount, AssetManagerError::InsufficientBalance);

    let cpi_accounts = Transfer {
        from: vault_token_account,
        to: recipient,
        authority,
    };
    let mint_bytes = mint.to_bytes();
    let seeds = &[
        b"vault".as_ref(),
        mint_bytes.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];
    token::transfer(CpiContext::new_with_signer(token_program, cpi_accounts, signer), amount)?;
    Ok(())
}

fn withdraw_native_token<'info>(
    vault_native_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    amount: u64,
    bump: u8
) -> Result<()> {
    require!(amount <= **vault_native_account.try_borrow_lamports()?, AssetManagerError::InsufficientBalance);

    let seeds = &[
        b"vault_native".as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &vault_native_account.key,
        &recipient.key,
        amount,
    );

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[
            vault_native_account,
            recipient,
            system_program
        ],
        signer,
    )?;

    Ok(())
}

pub fn verify_withdraw(token_state: &mut TokenState, amount: u64, balance: u64) -> Result<()> {
    let limit = calculate_limit(&token_state, balance)?;
    require!(balance.saturating_sub(amount) >= limit, AssetManagerError::ExceedsWithdrawLimit);

    token_state.current_limit = limit;
    token_state.last_update = Clock::get()?.unix_timestamp;

    Ok(())
}

fn balance_of(account: &Account<TokenAccount>) -> Result<u64> {
    Ok(account.amount)
}
