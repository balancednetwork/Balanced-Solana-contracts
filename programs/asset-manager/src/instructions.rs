use anchor_lang::{prelude::*, solana_program::program_pack::Pack};
use anchor_spl::token::{
        self, spl_token, TokenAccount, Transfer
    };

use xcall_manager::{XmState, program::XcallManager, cpi::accounts::VerifyProtocols};
use xcall::cpi::accounts::SendCallCtx;
use xcall_lib::message::{AnyMessage, call_message_rollback::CallMessageWithRollback, envelope::Envelope};
use xcall_lib::network_address::NetworkAddress;
use std::str::FromStr;

use crate::helpers::{decode_deposit_revert_msg, decode_method, decode_withdraw_to_msg };
use crate::{
        errors::CustomError, states::*, structs::{
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
) -> Result<()> {
    let state: &mut Account<State> = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_asset_manager = icon_asset_manager;
    state.xcall_manager = xcall_manager;
    state.admin = ctx.accounts.admin.key();
    Ok(())
}

pub fn configure_rate_limit(
    ctx: Context<ConfigureRateLimit>,
    token: Pubkey,
    period: u64,
    percentage: u64,
) -> Result<()> {
    require!(percentage <= POINTS, CustomError::PercentageTooHigh);
    let state = &mut ctx.accounts.state;

     require!(ctx.accounts.admin.key() == state.admin.key(), CustomError::Unauthorized);

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
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.clone().unwrap().to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    let token_addr = ctx.accounts.token_program.clone().unwrap().key().to_string();
    let from: Pubkey = ctx.accounts.user.key();
    let _ = send_deposit_message(
        ctx,
        token_addr,
        from,
        amount,
        to,
        data
    );
    Ok(())
}

pub fn deposit_native<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>, amount: u64, to: Option<String>, data: Option<Vec<u8>>) -> Result<()> {
    _deposit(ctx, amount, to, data)
}

fn _deposit<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>, amount: u64, to: Option<String>, data: Option<Vec<u8>>) -> Result<()> {
    require!(amount > 0, CustomError::InvalidAmount);
    
    let user = &ctx.accounts.user;
    let deposit_account = &mut ctx.accounts.vault_token_account;

    **deposit_account.to_account_info().try_borrow_mut_lamports()? += amount;
    **user.try_borrow_mut_lamports()? -= amount;

    let from: Pubkey = ctx.accounts.user.key();
    let _ = send_deposit_message(ctx, String::from_str( _NATIVE_ADDRESS).unwrap(), from, amount, to, data);
    Ok(())
}

fn send_deposit_message<'info>(
    ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>,
    token_address: String,
    from: Pubkey,
    amount: u64,
    to: Option<String>,
    data: Option<Vec<u8>>,
) -> Result<()> {
    require!(false, CustomError::TestError);
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

    let (signer_pda, _bump) = Pubkey::find_program_address(&[b"asset_manager_signer"], &ctx.program_id);
    require!(ctx.accounts.asset_manager.key() == signer_pda, CustomError::NotAssetManager);
    
    let xcall_config = &ctx.remaining_accounts[0];
    let xcall_reply = &ctx.remaining_accounts[1];
    let rollback_account = &ctx.remaining_accounts[2];
    let default_connection = &ctx.remaining_accounts[3];
    let fee_handler = &ctx.remaining_accounts[4];

    // the accounts for centralized connections is contained here.
    let remaining_accounts = ctx.remaining_accounts.split_at(5).1;
    let cpi_accounts: SendCallCtx = SendCallCtx {
        config: xcall_config.to_account_info(),
        reply: xcall_reply.to_account_info(),
        rollback_account: Some(rollback_account.to_account_info()),
        default_connection: default_connection.to_account_info(),
        fee_handler: fee_handler.to_account_info(),
        signer: ctx.accounts.asset_manager.clone(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx:CpiContext<'_, '_, '_, 'info, SendCallCtx<'info>>  = CpiContext::new(xcall_program, cpi_accounts).with_remaining_accounts(remaining_accounts.to_vec());
    #[cfg(not(test))]
    let _result: std::result::Result<xcall::cpi::Return<u128>, Error> = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_asset_manager);
    Ok(())
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

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>,
) -> Result<()> {
    let state = ctx.accounts.state.clone();
    require!(state.xcall == *ctx.accounts.signer.key, CustomError::UnauthorizedCaller);

    require!(
        verify_protocols(ctx.accounts.xcall_manager.clone(), ctx.accounts.xcall_manager_state.clone(), &protocols)?,
        CustomError::ProtocolMismatch
    );

    let method = decode_method(&data).unwrap();
    if method == WITHDRAW_TO {
        require!(from == state.icon_asset_manager, CustomError::NotIconAssetManager);
        let  message  = decode_withdraw_to_msg(&data).unwrap();
        let token_pubkey = Pubkey::from_str(&message.token_address).map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?;
        let recipient_pubkey = Pubkey::from_str(&message.user_address).map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?;
        require!(recipient_pubkey==ctx.accounts.to_address.key(), CustomError::InvalidToAddress);
        require!(token_pubkey==ctx.accounts.token_program.clone().unwrap().key(), CustomError::InvalidToAddress);
        let token_program = ctx.accounts.token_program.clone().unwrap();
        withdraw_token(
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.to_address.to_account_info(),
            message.amount as u64,
            token_program.clone().to_account_info(),
            token_program.clone().to_account_info(),
        )?;

    } if method == WITHDRAW_TO_NATIVE {
        require!(from == state.icon_asset_manager, CustomError::NotIconAssetManager);
        let  message  = decode_withdraw_to_msg(&data).unwrap();
        let recipient_pubkey = Pubkey::from_str(&message.user_address).map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?;
        require!(recipient_pubkey==ctx.accounts.to_address.key(), CustomError::InvalidToAddress);
        require!(message.token_address==_NATIVE_ADDRESS, CustomError::InvalidToAddress);
        withdraw_native_token(
            ctx.accounts.vault_token_account.to_account_info(),
            ctx.accounts.to_address.to_account_info(),
            message.amount as u64,
        )?;

    } else if method == DEPOSIT_REVERT {
        require!(from == state.xcall.key().to_string(), CustomError::NotIconAssetManager);

        let  message  = decode_deposit_revert_msg(&data).unwrap();
        let recipient_pubkey = Pubkey::from_str(&message.account).map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?;
        require!(recipient_pubkey==ctx.accounts.to_address.key(), CustomError::InvalidToAddress);
        if message.token_address == _NATIVE_ADDRESS {
            withdraw_native_token(
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.to_address.to_account_info(),
                message.amount as u64,
            )?;
        }else{
            let token_program = ctx.accounts.token_program.clone().unwrap();
            withdraw_token(
                ctx.accounts.vault_token_account.to_account_info(),
                ctx.accounts.to_address.to_account_info(),
                message.amount as u64,
                token_program.clone().to_account_info(),
                token_program.clone().to_account_info(),
            )?;
        }
    } else {
        return Err(CustomError::UnknownMessage.into());
    }

    Ok(())
}

fn withdraw_token<'info>(
    vault_token_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    amount: u64,
    token_program: AccountInfo<'info>,
    authority: AccountInfo<'info>
) -> Result<()> {
    let account_data = spl_token::state::Account::unpack(&vault_token_account.data.borrow())?;
    let vault_balance = account_data.amount;
    require!(vault_balance >= amount, CustomError::InsufficientBalance);


    let cpi_accounts = Transfer {
        from: vault_token_account,
        to: recipient,
        authority: authority,
    };

    token::transfer(CpiContext::new(token_program, cpi_accounts), amount)?;

    Ok(())
}

fn withdraw_native_token<'info>(
    vault_token_account: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &vault_token_account.key(),
        &recipient.key(),
        amount,
    );
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            vault_token_account,
            recipient,
        ],
    )?;
    Ok(())
}

pub fn verify_withdraw(token_state: &mut TokenState, amount: u64, balance: u64) -> Result<()> {
    let limit = calculate_limit(&token_state, balance)?;
    require!(balance.saturating_sub(amount) >= limit, CustomError::ExceedsWithdrawLimit);

    token_state.current_limit = limit;
    token_state.last_update = Clock::get()?.unix_timestamp;

    Ok(())
}

fn balance_of(account: &Account<TokenAccount>) -> Result<u64> {
    Ok(account.amount)
}
