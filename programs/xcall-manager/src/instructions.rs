use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar;
use anchor_lang::solana_program::sysvar::instructions::get_instruction_relative;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;
use crate::configure_protocols::CONFIGURE_PROTOCOLS;
use crate::helpers::{decode_handle_call_msg, decode_method};
use crate::states::*;
use crate::errors::*;


pub fn initialize(ctx: Context<Initialize>, xcall: Pubkey, icon_governance: String, sources: Vec<String>, destinations: Vec<String>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    state.xcall = xcall;
    state.icon_governance = icon_governance;
    state.sources = sources;
    state.destinations = destinations;
    state.admin = *ctx.accounts.admin.key;
    Ok(())
}

pub fn whitelist_action(ctx: Context<AdminAction>, action: Vec<u8>) -> Result<()> {
    let xcall_manager = &mut ctx.accounts.state;
    xcall_manager.whitelisted_actions.push(action);
    Ok(())
}

pub fn remove_action(ctx: Context<AdminAction>, action: Vec<u8>) -> Result<()> {
    let xcall_manager = &mut ctx.accounts.state;
    xcall_manager.whitelisted_actions.retain(|a| a != &action);
    Ok(())
}

pub fn propose_removal(ctx: Context<AdminAction>, protocol: String) -> Result<()> {
    let xcall_manager = &mut ctx.accounts.state;
    xcall_manager.proposed_protocol_to_remove = protocol;
    Ok(())
}

pub fn set_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
    let xcall_manager = &mut ctx.accounts.state;
    require_keys_eq!(
        ctx.accounts.admin.key(),xcall_manager.admin,
        XCallManagerError::Unauthorized
    );
    xcall_manager.admin = new_admin;
    Ok(())
}

pub fn set_protocols(ctx: Context<AdminAction>, sources: Vec<String>, destinations: Vec<String>) -> Result<()> {
    let xcall_manager = &mut ctx.accounts.state;
    require_keys_eq!(
        ctx.accounts.admin.key(),xcall_manager.admin,
        XCallManagerError::Unauthorized
    );
    xcall_manager.sources = sources;
    xcall_manager.destinations = destinations;
    Ok(())
}

pub fn verify_protocols(
    ctx: Context<VerifyProtocols>, protocols: &Vec<String>
 )-> Result<bool> {
    let verified = verify_protocol_recovery(ctx.accounts.state.proposed_protocol_to_remove.clone(), &ctx.accounts.state.sources, protocols)?;
     Ok(verified)
 }

fn verify_protocol_recovery(proposal_to_remove: String, sources: &Vec<String>, protocols: &Vec<String>) -> Result<bool> {
    require!(proposal_to_remove != "".to_string(), XCallManagerError::NoProposalForRemovalExists);
    let mut modified_sources = Vec::new();
    for source in sources {
        let non_ref_source = source.clone();
        if non_ref_source != proposal_to_remove {
            modified_sources.push(non_ref_source);
        }
    }
    require!(verify_protocols_unordered(&modified_sources, &protocols), XCallManagerError::ProtocolMismatch);
    Ok(true)
}

pub fn verify_protocols_unordered(array1: &Vec<String>, array2: &Vec<String>) -> bool {
    if array1.len() != array2.len() {
        return false;
    }

    for item1 in array2 {
        let mut found = false;
        for item2 in array1 {
            if item1 == item2 {
                found = true;
                break;
            }
        }
        if !found {
            return false;
        }
    }
    true
}

pub fn handle_call_message<'info>(
    ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    from: String,
    data: Vec<u8>,
    protocols: Vec<String>,
) -> Result<HandleCallMessageResponse> {
    let state = ctx.accounts.state.clone();
    let sysvar_account = &ctx.accounts.instruction_sysvar.to_account_info();
    let current_ix = get_instruction_relative(0, sysvar_account)?;
    if current_ix.program_id != state.xcall {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: XCallManagerError::OnlyXcall.to_string()
        });
    }

    if from != ctx.accounts.state.icon_governance  {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: XCallManagerError::NotTheIconGovernance.to_string()
        });
    }

    let xcall_manager = &mut ctx.accounts.state;
    if !xcall_manager.whitelisted_actions.contains(&data) {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: XCallManagerError::ActionNotWhitelisted.to_string()
        });
    }
    xcall_manager.whitelisted_actions.retain(|a| a != &data);

    let verified: bool = verify_protocol_recovery(ctx.accounts.state.proposed_protocol_to_remove.clone(), &ctx.accounts.state.sources, &protocols)?;
    if !verified {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: XCallManagerError::ProtocolMismatch.to_string()
        });
    }

    let method = decode_method(&data)?;
    let message = decode_handle_call_msg(&data)?;
    if method == CONFIGURE_PROTOCOLS {
        require!(from == ctx.accounts.state.icon_governance, XCallManagerError::InvalidSender);
        let xcall_manager = &mut ctx.accounts.state;
        xcall_manager.sources = message.sources;
        xcall_manager.destinations = message.destinations;
        return Ok(HandleCallMessageResponse {
            success: true,
            message: "Success".to_owned()
        });
    } else {
        return Ok(HandleCallMessageResponse {
            success: false,
            message: XCallManagerError::UnknownMessageType.to_string()
        });
    }
}

pub fn get_handle_call_message_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>) -> Result<ParamAccounts>{
    let  accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new(ctx.accounts.state.key(), false),
    ];
    Ok(ParamAccounts{
        accounts,
    })
}