use anchor_lang::prelude::*;
pub mod instructions;
pub mod errors;
pub mod states;
pub mod helpers;
pub mod structs;
pub mod params_builder;

use states::*;

declare_id!("DZ7JPmWHWTePh2B98U3cPUJqcyCr7YGy7uWJUXWfZYHN");

#[program]
pub mod asset_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, xcall: Pubkey, icon_asset_manager: String, 
        xcall_manager: Pubkey, xcall_manager_state: Pubkey) -> Result<()> {
        instructions::initialize(ctx, xcall, icon_asset_manager, xcall_manager, xcall_manager_state)
    }

    pub fn configure_rate_limit(
        ctx: Context<ConfigureRateLimit>,
        token: Pubkey,
        period: u64,
        percentage: u64,
    ) -> Result<()> {
        instructions::configure_rate_limit(ctx, token, period, percentage)
    }

    pub fn get_withdraw_limit(ctx: Context<GetWithdrawLimit>) -> Result<u64> {
        instructions::get_withdraw_limit(ctx)
    } 

    pub fn deposit_native<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>,  amount: u64, to:Option<String>, data: Option<Vec<u8>>) -> Result<()> {
        // Transfer SOL
        instructions::deposit_native(ctx, amount, to, data)
    }

    pub fn deposit_token<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>, amount: u64, to:Option<String>, data: Option<Vec<u8>>) -> Result<()> {
        // Transfer SPL Token
        instructions::deposit_token(ctx, amount, to, data)
    }

    pub fn handle_call_message<'info>(
        ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
        from: String,
        data: Vec<u8>,
        protocols: Vec<String>,
    ) -> Result<()>{
        instructions::handle_call_message(ctx, from, data, protocols)
    }
    
}