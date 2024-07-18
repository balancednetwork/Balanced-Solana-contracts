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

use crate::{
        errors::BalancedDollarError, helpers::*, states::*, structs::{
        cross_transfer::CROSS_TRANSFER,
        cross_transfer_revert::{ CrossTransferRevert, CROSS_TRANSFER_REVERT},
    }
};

pub fn initialize(
    ctx: Context<Initialize>,
    xcall: Pubkey,
    icon_bn_usd: String,
    xcall_manager: Pubkey,
    bn_usd_token: Pubkey
) -> Result<()> {
    let balanced_dollar = &mut ctx.accounts.balanced_dollar;
    balanced_dollar.xcall = xcall;
    balanced_dollar.icon_bn_usd = icon_bn_usd;
    balanced_dollar.xcall_manager = xcall_manager;
    balanced_dollar.owner = *ctx.accounts.admin.key;
    balanced_dollar.bn_usd_token = bn_usd_token;
    Ok(())
}

pub fn cross_transfer<'info>(
    ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
    value: u64,
    data: Option<Vec<u8>>,
) -> Result<()> {
    require!(value > 0, BalancedDollarError::InvalidAmount);
    require!(ctx.accounts.state.bn_usd_token == ctx.accounts.token_program.key(), BalancedDollarError::NotBalancedDollar);
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::burn(burn_ctx, value)?;

    let message_data = data.unwrap_or(vec![]);
    let rollback_message = CrossTransferRevert::create(ctx.accounts.user.key().to_string(), value).encode();

    let sources = &ctx.accounts.xcall_manager_state.sources;
    let destinations = &ctx.accounts.xcall_manager_state.destinations;

    let message = AnyMessage::CallMessageWithRollback(CallMessageWithRollback { data: message_data, rollback: rollback_message });
    let envelope: Envelope = Envelope::new(message, sources.clone(), destinations.clone());
    let envelope_encoded = rlp::encode(&envelope).to_vec();
    
    let icon_asset_manager = NetworkAddress::from_str(&ctx.accounts.state.icon_bn_usd).unwrap(); //todo: get network address without unwrap

    let (signer_pda, _bump) = Pubkey::find_program_address(&[b"balanced_dollar"], &ctx.program_id);
    require!(ctx.accounts.balanced_dollar.key() == signer_pda, BalancedDollarError::NotBalancedDollar);
    
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
        signer: ctx.accounts.balanced_dollar.clone(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx:CpiContext<'_, '_, '_, 'info, SendCallCtx<'info>>  = CpiContext::new(xcall_program, cpi_accounts).with_remaining_accounts(remaining_accounts.to_vec());
    let _result: std::result::Result<xcall::cpi::Return<u128>, Error> = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_asset_manager);
    
    Ok(())
}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>,
) -> Result<()> {
    require!(verify_protocols(&ctx.accounts.xcall_manager, &ctx.accounts.xcall_manager_state, &protocols)?, BalancedDollarError::InvalidProtocols);
    let seeds = &[
        b"bnusd_authority".as_ref(),
        &ctx.accounts.mint_authority.key().to_bytes()[..],
        &[12]
    ];
    let signer = &[&seeds[..]];
    let method = String::from_utf8(data[0..4].to_vec()).map_err(|_| BalancedDollarError::DecoderError)?;
    
    if method == CROSS_TRANSFER {
        require!(from == ctx.accounts.state.icon_bn_usd, BalancedDollarError::InvalidSender);
        let message = decode_cross_transfer_revert(&data)?;
        mint(
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            message.amount,
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