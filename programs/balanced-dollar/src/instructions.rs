use anchor_lang::prelude::*;
use anchor_spl::{token::{self, Burn, MintTo}, associated_token::get_associated_token_address};

use crate::errors::BalancedDollarError;
use std::str::FromStr;
use xcall::cpi::accounts::{HandleForcedRollbackCtx, SendCallCtx};
use xcall_lib::message::{
    call_message_rollback::CallMessageWithRollback, envelope::Envelope, AnyMessage,
};
use xcall_lib::network_address::NetworkAddress;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;
use xcall_manager::{cpi::accounts::VerifyProtocols, program::XcallManager, XmState};

use crate::param_accounts::get_accounts;
use crate::{
    helpers::*,
    states::*,
    structs::{
        cross_transfer::{CrossTransferMsg, CROSS_TRANSFER},
        cross_transfer_revert::{CrossTransferRevert, CROSS_TRANSFER_REVERT},
    },
};

pub fn initialize(
    ctx: Context<Initialize>,
    xcall: Pubkey,
    icon_bn_usd: String,
    xcall_manager: Pubkey,
    bn_usd_token: Pubkey,
    xcall_manager_state: Pubkey,
) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_bn_usd = icon_bn_usd;
    state.xcall_manager = xcall_manager;
    state.xcall_manager_state = xcall_manager_state;
    state.bn_usd_token = bn_usd_token;
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

pub fn cross_transfer<'info>(
    ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
    to: String,
    icon_bnusd_value: u128,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    require!(icon_bnusd_value > 0, BalancedDollarError::InvalidAmount);
    let mut value = (icon_bnusd_value / 10_u128.pow(9)) as u64;
    if icon_bnusd_value % 10_u128.pow(9) > 0 {
        value += 1;
    }
    require!(
        ctx.accounts.from.amount >= value,
        BalancedDollarError::InsufficientBalance
    );
    require!(
        ctx.accounts.state.bn_usd_token == ctx.accounts.mint.key(),
        BalancedDollarError::NotBalancedDollar
    );
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.from.to_account_info(),
            authority: ctx.accounts.from_authority.to_account_info(),
        },
    );
    token::burn(burn_ctx, value)?;
    send_message(ctx, to, icon_bnusd_value, data)
}

fn send_message <'info>(
    ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
    to: String,
    value: u128,
    data: Option<Vec<u8>>,
) -> Result<u128> {
    let message: Vec<u8> =
        CrossTransferMsg::create(ctx.accounts.from_authority.key().to_string(), to, value, data.unwrap_or(vec![]))
            .encode();
    let rollback_message =
        CrossTransferRevert::create(ctx.accounts.from_authority.key().to_string(), value).encode();
    let sources = &ctx.accounts.xcall_manager_state.sources;
    let destinations = &ctx.accounts.xcall_manager_state.destinations;
    let message = AnyMessage::CallMessageWithRollback(CallMessageWithRollback {
        data: message,
        rollback: rollback_message,
    });
    let envelope: Envelope = Envelope::new(message, sources.clone(), destinations.clone());
    let envelope_encoded = rlp::encode(&envelope).to_vec();

    let icon_bn_usd = NetworkAddress::from_str(&ctx.accounts.state.icon_bn_usd)?;
    let xcall_config = &ctx.remaining_accounts[0];
    let rollback_account = &ctx.remaining_accounts[1];
    let sysvar_account = &ctx.remaining_accounts[2];
    let fee_handler = &ctx.remaining_accounts[3];
    // the accounts for centralized connections is contained here.
    let remaining_accounts = ctx.remaining_accounts.split_at(4).1;
    let xcall_authority = &ctx.accounts.xcall_authority;
    let cpi_accounts: SendCallCtx = SendCallCtx {
        config: xcall_config.to_account_info(),
        rollback_account: Some(rollback_account.to_account_info()),
        fee_handler: fee_handler.to_account_info(),
        signer: ctx.accounts.from_authority.to_account_info(),
        instruction_sysvar: sysvar_account.to_account_info(),
        dapp_authority: Some(xcall_authority.to_account_info()),
        system_program: ctx.accounts.system_program.to_account_info(),
    };
    let bump = ctx.bumps.xcall_authority;
    let seeds = &[Authority::SEED_PREFIX.as_ref(), &[bump]];
    let signer_seeds = &[&seeds[..]];
    let xcall_program = ctx.accounts.xcall.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(xcall_program, cpi_accounts, signer_seeds)
         .with_remaining_accounts(remaining_accounts.to_vec());
    let result = xcall::cpi::send_call(cpi_ctx, envelope_encoded, icon_bn_usd)?;
    Ok(result.get())

}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>,
) -> Result<HandleCallMessageResponse> {
    let state: Account<'info, State> = ctx.accounts.state.clone();
    if !verify_protocols(
        &ctx.accounts.xcall_manager,
        &ctx.accounts.xcall_manager_state,
        &protocols,
    )? {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: BalancedDollarError::InvalidProtocols.to_string(),
        });
    }
    let to_authority = ctx.accounts.to_authority.key();

    let bump = ctx.bumps.mint_authority;
    let seeds = &[b"bnusd_authority".as_ref(), &[bump]];
    let signer = &[&seeds[..]];
    let method = decode_method(&data)?;
    if method == CROSS_TRANSFER {
        if from != state.icon_bn_usd {
            return Ok(HandleCallMessageResponse {
                success: false,
                message: BalancedDollarError::InvalidSender.to_string(),
            });
        }
        let message = decode_cross_transfer(&data)?;
        let recipient_pubkey = Pubkey::from_str(account_from_network_address(message.to)?.as_str())
            .map_err(|_| BalancedDollarError::NotAnAddress)?;
        if recipient_pubkey != to_authority {
            return Err(BalancedDollarError::InvalidToAddress.into());
        }
        mint(
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            translate_incoming_amount(message.value),
            signer,
        )?;
        return Ok(HandleCallMessageResponse {
            success: true,
            message: "Success".to_owned(),
        });
    } else if method == CROSS_TRANSFER_REVERT {
        let from_network_address = NetworkAddress::from_str(&from)?;
        if from_network_address.account() != state.xcall.to_string() {
            return Ok(HandleCallMessageResponse {
                success: false,
                message: BalancedDollarError::InvalidSender.to_string(),
            });
        }
        let message = decode_cross_transfer_revert(&data)?;
        let recipient_pubkey =
            Pubkey::from_str(&message.account).map_err(|_| BalancedDollarError::NotAnAddress)?;
        if recipient_pubkey != to_authority {
            return Err(BalancedDollarError::InvalidToAddress.into());
        }
        mint(
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.to.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            translate_incoming_amount(message.amount),
            signer,
        )?;
        return Ok(HandleCallMessageResponse {
            success: true,
            message: "Success".to_owned(),
        });
    } else {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: BalancedDollarError::UnknownMessageType.to_string(),
        });
    }
}

fn mint<'info>(
    mint: AccountInfo<'info>,
    to: AccountInfo<'info>,
    authority: AccountInfo<'info>,
    program: AccountInfo<'info>,
    amount: u64,
    signer: &[&[&[u8]]],
) -> Result<()> {
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
    let method = decode_method(&data)?;
    if method == CROSS_TRANSFER {
        let message: CrossTransferMsg = decode_cross_transfer(&data)?;

        let user_address = Pubkey::from_str(account_from_network_address(message.to)?.as_str())
            .map_err(|_| BalancedDollarError::NotAnAddress)?;
        let user_token_address =
            get_associated_token_address(&user_address, &ctx.accounts.state.bn_usd_token);

        Ok(ParamAccounts {
            accounts: get_accounts(ctx, user_address, user_token_address)?,
        })
    } else if method == CROSS_TRANSFER_REVERT {
        let message = decode_cross_transfer_revert(&data)?;
        let user_address =
            Pubkey::from_str(&message.account).map_err(|_| BalancedDollarError::NotAnAddress)?;
        let user_token_address =
            get_associated_token_address(&user_address, &ctx.accounts.state.bn_usd_token);
        Ok(ParamAccounts {
            accounts: get_accounts(ctx, user_address, user_token_address)?,
        })
    } else {
        let accounts: Vec<ParamAccountProps> = vec![];
        Ok(ParamAccounts { accounts })
    }
}

pub fn force_rollback<'info>(
    ctx: Context<'_, '_, '_, 'info, ForceRollback<'info>>,
    request_id: u128,
    source_nid: String,
    connection_sn: u128,
    dst_program_id: Pubkey,

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
        
    let _result = xcall::cpi::handle_forced_rollback(cpi_ctx, request_id, source_nid, connection_sn, dst_program_id)?;
    Ok(())
}

pub fn account_from_network_address(string_network_address: String) -> Result<String> {
    let parts = string_network_address.split('/').collect::<Vec<&str>>();
    require!(parts.len() == 2, BalancedDollarError::InvalidNetworkAddress);
    Ok(parts[1].to_string())
}

pub fn translate_outgoing_amount(amount: u64) -> u128 {
    (amount as u128) * 10_u64.pow(9) as u128
}

pub fn translate_incoming_amount(amount: u128) -> u64 {
    (amount / 10_u64.pow(9) as u128) as u64
}
