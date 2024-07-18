use anchor_lang::prelude::*;
pub mod instructions;
pub mod errors;
pub mod states;
pub mod helpers;
pub mod structs;

use states::*;

declare_id!("AZ8nHSx5wmhz8mo5VSPBxKaZAQLtrf268WraTPxELCSd");

#[program]
pub mod balanced_dollar {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        xcall: Pubkey,
        icon_bn_usd: String,
        xcall_manager: Pubkey,
        bn_usd_token: Pubkey
    ) -> Result<()> {
        instructions::initialize(ctx, xcall, icon_bn_usd, xcall_manager, bn_usd_token)
        //Ok(())
    }

    pub fn cross_transfer<'info>(
        ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
        value: u64,
        data: Option<Vec<u8>>,
    ) -> Result<()> {
        let _ = instructions::cross_transfer(ctx, value, data);
        Ok(())
    }

    pub fn handle_call_message<'info>(
        ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
        from: String,
        data: Vec<u8>,
        protocols: Vec<String>,
    ) -> Result<()> {
        let _ = instructions::handle_call_message(ctx, from, data, protocols);
        Ok(())
    }

    


}
