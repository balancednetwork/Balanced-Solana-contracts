use anchor_lang::prelude::*;
pub mod errors;
pub mod helpers;
pub mod instructions;
pub mod param_accounts;
pub mod states;
pub mod structs;
use states::*;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;

declare_id!("Ahs9cC6PMGhasB5zUboUVNBJxAStmX1aeENDiWLz2AXH");

#[program]
pub mod balanced_dollar {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        xcall: Pubkey,
        icon_bn_usd: String,
        xcall_manager: Pubkey,
        bn_usd_token: Pubkey,
        xcall_manager_state: Pubkey,
    ) -> Result<()> {
        instructions::initialize(
            ctx,
            xcall,
            icon_bn_usd,
            xcall_manager,
            bn_usd_token,
            xcall_manager_state,
        )
    }

    pub fn set_admin(
        ctx: Context<SetAdmin>,
        admin: Pubkey,
    ) -> Result<()> {
        instructions::set_admin(
            ctx,
            admin
        )
    }

    pub fn set_token_creation_fee(
        ctx: Context<SetTokenCreationFee>,
        token_creation_fee: u64,
    ) -> Result<()> {
        instructions::set_token_creation_fee(
            ctx,
            token_creation_fee
        )
    }

    pub fn cross_transfer<'info>(
        ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
        to: String,
        icon_bnusd_value: u128,
        data: Option<Vec<u8>>,
    ) -> Result<u128> {
        instructions::cross_transfer(ctx, to,icon_bnusd_value, data)
    }

    pub fn handle_call_message<'info>(
        ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
        from: String,
        data: Vec<u8>,
        protocols: Vec<String>,
    ) -> Result<HandleCallMessageResponse> {
        instructions::handle_call_message(ctx, from, data, protocols)
    }

    pub fn force_rollback<'info>(
        ctx: Context<'_, '_, '_, 'info, ForceRollback<'info>>,
        request_id: u128,
        source_nid: String,
        connection_sn: u128,
        dst_program_id: Pubkey
    ) -> Result<()> {
        instructions::force_rollback(ctx, request_id, source_nid, connection_sn, dst_program_id)
    }

    pub fn query_handle_call_message_accounts<'info>(
        ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
        _from: String,
        data: Vec<u8>,
        _protocols: Vec<String>,
    ) -> Result<ParamAccounts> {
        return instructions::get_handle_call_message_accounts(ctx, data);
    }
}
