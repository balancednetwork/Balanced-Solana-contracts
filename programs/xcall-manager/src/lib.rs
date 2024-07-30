pub mod errors;
pub mod instructions;
pub mod states;
pub mod helpers;
pub mod configure_protocols;
pub mod param_accounts;
pub mod query_account_types;

use anchor_lang::prelude::*;
pub use states::*;
declare_id!("7vfrBqZFbvfKCqVC3v7dEh8V6RV9afRu1ySuLLauCMTL");

#[program]
pub mod xcall_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, xcall: Pubkey, icon_governance: String, sources: Vec<String>, destinations: Vec<String>) -> Result<()> {
        instructions::initialize(ctx, xcall, icon_governance, sources, destinations)
    }

    pub fn propose_removal(ctx: Context<AdminAction>, protocol: String) -> Result<()> {
        instructions::propose_removal(ctx, protocol)
    }

    pub fn whitelist_action(ctx: Context<AdminAction>, action: Vec<u8>) -> Result<()> {
        instructions::whitelist_action(ctx, action)
    }

    pub fn remove_action(ctx: Context<AdminAction>, action: Vec<u8>) -> Result<()> {
        instructions::remove_action(ctx, action)
    }

    pub fn set_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
        instructions::set_admin(ctx, new_admin)
    }
    pub fn set_protocols(ctx: Context<AdminAction>, sources: Vec<String>, destinations: Vec<String>) -> Result<()> {
        instructions::set_protocols(ctx, sources, destinations)
    }

    pub fn verify_protocols<'info>(ctx: Context<'_, '_, '_, 'info, VerifyProtocols<'info>>, protocols: Vec<String>) -> Result<bool> {
        instructions::verify_protocols(ctx, &protocols)
    }

    pub fn handle_call_message<'info>(
        ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
        from: String,
        data: Vec<u8>,
        protocols: Vec<String>,
    ) -> Result<()> {
        instructions::handle_call_message(ctx, from, data, protocols)
    }

    // pub fn get_handle_call_message_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<ParamAccounts>{
    //     return instructions:: get_handle_call_message_accounts(ctx, data);
    // }
    // pub fn query_handle_call_message_accounts<'info>(
    //     ctx: Context<'_, '_, '_, 'info, GetAccounts<'info>>,
    //     req_id: u128,
    //     data: Vec<u8>,
    //     page: u8,
    //     limit: u8,
    // ) -> Result<QueryAccountsPaginateResponse> {
    //     instructions::query_execute_call_accounts(ctx, req_id, data, page, limit)
    // }
}
