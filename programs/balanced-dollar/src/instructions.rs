use anchor_lang::prelude::*;
use anchor_spl::
    token::{
        self, Burn, MintTo,
    };

use xcall_manager::{XmState, program::XcallManager, cpi::accounts::VerifyProtocols};
use xcall::cpi::accounts::SendCallCtx;
use xcall_lib::message::{AnyMessage, call_message_rollback::CallMessageWithRollback, envelope::Envelope};
use xcall_lib::network_address::NetworkAddress;
use std::str::FromStr;
use crate::errors::BalancedDollarError;

use crate::param_accounts::get_accounts;
use crate::{
        helpers::*, states::*, structs::{
        cross_transfer::{ CrossTransferMsg, CROSS_TRANSFER, },
        cross_transfer_revert::{ CrossTransferRevert, CROSS_TRANSFER_REVERT},
    }
};

pub fn initialize(
    ctx: Context<Initialize>,
    xcall: Pubkey,
    icon_bn_usd: String,
    xcall_manager: Pubkey,
    bn_usd_token: Pubkey,
    xcall_manager_state: Pubkey
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_bn_usd = icon_bn_usd;
    state.xcall_manager = xcall_manager;
    state.xcall_manager_state  = xcall_manager_state;
    state.bn_usd_token = bn_usd_token;
    Ok(())
}

pub fn cross_transfer<'info>(
    ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
    to: String,
    value: u64,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    require!(value > 0, BalancedDollarError::InvalidAmount);
    require!(ctx.accounts.from.amount>=value, BalancedDollarError::InsufficientBalance );
    //require!(ctx.accounts.state.bn_usd_token == ctx.accounts.token_program.key(), BalancedDollarError::NotBalancedDollar);
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        },
    );
    token::burn(burn_ctx, value)?;
    let message_data = data.unwrap_or(vec![]);
    let message = CrossTransferMsg::create(ctx.accounts.from.key().to_string(), to, value, message_data).encode();
    let rollback_message = CrossTransferRevert::create(ctx.accounts.from.key().to_string(), value).encode();
    let sources = &ctx.accounts.xcall_manager_state.sources;
    let destinations = &ctx.accounts.xcall_manager_state.destinations;

    let message = AnyMessage::CallMessageWithRollback(CallMessageWithRollback { data: message, rollback: rollback_message });
    let envelope: Envelope = Envelope::new(message, sources.clone(), destinations.clone());
    let envelope_encoded = rlp::encode(&envelope).to_vec();
    
    let icon_bn_usd = NetworkAddress::from_str(&ctx.accounts.state.icon_bn_usd)?;
    let xcall_config = &ctx.remaining_accounts[0];
    let rollback_account = &ctx.remaining_accounts[1];
    let sysvar_account = &ctx.remaining_accounts[2];
    let fee_handler = &ctx.remaining_accounts[3];
    // the accounts for centralized connections is contained here.
    let remaining_accounts = ctx.remaining_accounts.split_at(4).1;
    let cpi_accounts: SendCallCtx = SendCallCtx {
        config: xcall_config.to_account_info(),
        rollback_account: Some(rollback_account.to_account_info()),
        fee_handler: fee_handler.to_account_info(),
        signer: ctx.accounts.from_authority.to_account_info(),
        instruction_sysvar: sysvar_account.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let bump = ctx.bumps.state;
    let seeds = &[
        b"state".as_ref(),
        &[bump],
    ];
    let signer_seeds = &[&seeds[..]];
    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx  = CpiContext::new_with_signer(xcall_program, cpi_accounts, signer_seeds).with_remaining_accounts(remaining_accounts.to_vec());
    let result = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_bn_usd)?;
    Ok(result.get())
}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>
) -> Result<()> {
    require!(verify_protocols(&ctx.accounts.xcall_manager, &ctx.accounts.xcall_manager_state, &protocols)?, BalancedDollarError::InvalidProtocols);
    let bump = ctx.bumps.mint_authority;
    let seeds = &[b"bnusd_authority".as_ref(), &[bump]];
    let signer = &[&seeds[..]];
    let method = decode_method(&data)?;
    if method == CROSS_TRANSFER {
        require!(from == ctx.accounts.state.icon_bn_usd, BalancedDollarError::InvalidSender);
        let message = decode_cross_transfer(&data)?;
        mint(
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            message.value,
            signer
        )?;
    } else if method == CROSS_TRANSFER_REVERT {
        require!(from == ctx.accounts.state.xcall.to_string(), BalancedDollarError::InvalidSender);
        let message = decode_cross_transfer_revert(&data)?;
        mint(
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            message.amount,
            signer
        )?;
    } else {
        return Err(BalancedDollarError::UnknownMessageType.into());
    }
    Ok(())
}

fn mint<'info>(mint: AccountInfo<'info>, 
                to: AccountInfo<'info>, 
                authority: AccountInfo<'info>, 
                program: AccountInfo<'info>,  
                amount: u64, signer: &[&[&[u8]]]) -> Result<()> {
    let cpi_accounts = MintTo {
        mint,
        to,
        authority,
    };

    let cpi_ctx = CpiContext::new_with_signer(program, cpi_accounts, signer);
    token::mint_to(cpi_ctx, amount)?;
    Ok(())
}

pub fn verify_protocols<'info>(
    xcall_manager_program: &Program<'info, XcallManager>,
    xm_state: &Account<'info, XmState>,
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
    let method = decode_method(&data)?;
    if method == CROSS_TRANSFER {
        let message = decode_cross_transfer(&data)?;
        let user_address = Pubkey::from_str(&message.to).map_err(|_| BalancedDollarError::NotAnAddress)?;
        Ok(ParamAccounts {
            accounts: get_accounts(ctx, user_address)?
        })
    } else if method == CROSS_TRANSFER_REVERT {
        let message = decode_cross_transfer(&data)?;
        let user_address = Pubkey::from_str(&message.to).map_err(|_| BalancedDollarError::NotAnAddress)?;
        Ok(ParamAccounts {
            accounts: get_accounts(ctx, user_address)?
        })
    }else{
        let accounts: Vec<ParamAccountProps> = vec![];
        Ok(ParamAccounts{
            accounts
        })
    }
}