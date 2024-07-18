use anchor_lang::prelude::*;
pub mod instructions;
pub mod errors;
pub mod states;
pub mod helpers;
pub mod structs;

use instructions::*;
use states::*;
use anchor_spl::token::{self, Token, Transfer, TokenAccount};

declare_id!("5A4zc47C8yRf94szVu4DBF45mwm8uWprbXAcYbESUzmm");

#[program]
pub mod asset_manager {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, xcall: Pubkey, icon_asset_manager: String, xcall_manager: Pubkey) -> Result<()> {
        instructions::initialize(ctx, xcall, icon_asset_manager, xcall_manager)
    }

    pub fn configure_rate_limit(
        ctx: Context<ConfigureRateLimit>,
        token: Pubkey,
        period: u64,
        percentage: u64,
    ) -> Result<()> {
        instructions::configure_rate_limit(ctx, token, period, percentage)
    }

    pub fn get_withdraw_limit(ctx: Context<GetWithdrawLimit>, token: Pubkey) -> Result<u64> {
        instructions::get_withdraw_limit(ctx)
    } 

    // pub fn deposit_native(ctx: Context<DepositNative>, amount: u64, to:Option<String>, data: Option<Vec<u8>>) -> Result<()> {
    //     // Transfer SOL
    //     instructions::deposit_native(ctx, amount, to, data)
    // }

    pub fn deposit_token<'info>(ctx:Context<'_, '_, '_, 'info, DepositToken<'info>>, amount: u64, to:Option<String>, data: Option<Vec<u8>>) -> Result<()> {
        // Transfer SPL Token
        instructions::deposit_token(ctx, amount, to, data)
    }

    // pub fn handle_call_message<'info>(
    //     ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
    //     data: Vec<u8>,
    //     protocols: Vec<String>,
    // ) -> Result<()>{
    //     instructions::handle_call_message(ctx, data, protocols)
    // }
    
}