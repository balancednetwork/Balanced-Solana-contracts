pub mod errors;
pub mod instructions;
pub mod states;
pub mod helpers;
pub mod configure_protocols;

use anchor_lang::prelude::*;
pub use states::*;

declare_id!("E8YhCgRvjfjeoGZxrpf7oQVwKeA3ra67EbzcvJcMPrKg");

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

    pub fn verify_protocols<'info>(ctx: Context<'_, '_, '_, 'info, VerifyProtocols<'info>>, protocols: Vec<String>) -> Result<()> {
        let _ = instructions::verify_protocols(ctx, &protocols);
        Ok(())
    }

    // pub fn execute_call(
    //     ctx: Context<ExecuteCall>,
    //     request_id: u128,
    //     data: Vec<u8>,
    // ) -> Result<()> {
    //     instructions::execute_call(ctx, request_id, data)
    // }
}
