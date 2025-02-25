use anchor_lang::prelude::*;
pub mod errors;
pub mod helpers;
pub mod instructions;
pub mod param_accounts;
pub mod states;
pub mod structs;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;

use states::*;

declare_id!("4u979CPSHUeJQbCYUAvoki4CQHDiG1257vt2DaJULPV9");

#[program]
pub mod asset_manager {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        xcall: Pubkey,
        icon_asset_manager: String,
        xcall_manager: Pubkey,
        xcall_manager_state: Pubkey,
    ) -> Result<()> {
        instructions::initialize(
            ctx,
            xcall,
            icon_asset_manager,
            xcall_manager,
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

    pub fn configure_rate_limit(
        ctx: Context<ConfigureRateLimit>,
        token: Pubkey,
        period: u64,
        percentage: u64,
    ) -> Result<()> {
        instructions::configure_rate_limit(ctx, token, period, percentage)
    }

    pub fn set_token_account_creation_fee(
        ctx: Context<SetTokenAccountCreationFee>,
        token: Pubkey,
        token_account_creation_fee: u64
    ) -> Result<()> {
        instructions::set_token_account_creation_fee(ctx, token, token_account_creation_fee)
    }

    pub fn get_withdraw_limit(ctx: Context<GetWithdrawLimit>) -> Result<u64> {
        instructions::get_withdraw_limit(ctx)
    }

    pub fn deposit_native<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositToken<'info>>,
        amount: u64,
        to: Option<String>,
        data: Option<Vec<u8>>,
    ) -> Result<u128> {
        // Transfer SOL
        instructions::deposit_native(ctx, amount, to, data)
    }

    pub fn deposit_token<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositToken<'info>>,
        amount: u64,
        to: Option<String>,
        data: Option<Vec<u8>>,
    ) -> Result<u128> {
        // Transfer SPL Token
        instructions::deposit_token(ctx, amount, to, data)
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
        dst_program_id: Pubkey,
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
