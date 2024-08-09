use anchor_lang::prelude::*;
pub mod instructions;
pub mod errors;
pub mod states;
pub mod helpers;
pub mod structs;
pub mod param_accounts;
use xcall_lib::xcall_dapp_type::HandleCallMessageResponse;
use states::*;

declare_id!("7pvzYSgsMmK81xtXFCD5VQVbCZurTFxPNQ2FZHUd5rTY");

#[program]
pub mod balanced_dollar {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        xcall: Pubkey,
        icon_bn_usd: String,
        xcall_manager: Pubkey,
        bn_usd_token: Pubkey,
        xcall_manager_state: Pubkey
    ) -> Result<()> {
        instructions::initialize(ctx, xcall, icon_bn_usd, xcall_manager, bn_usd_token, xcall_manager_state)
    }

    pub fn cross_transfer<'info>(
        ctx: Context<'_, '_, '_, 'info, CrossTransfer<'info>>,
        to: String,
        value: u64,
        data: Option<Vec<u8>>,
    ) -> Result<u128> {
        instructions::cross_transfer(ctx, to, value, data)
    }

    pub fn handle_call_message<'info>(
        ctx: Context<'_, '_, '_, 'info, HandleCallMessage<'info>>,
        from: String,
        data: Vec<u8>,
        protocols: Vec<String>,
    ) -> Result<HandleCallMessageResponse> {
        instructions::handle_call_message(ctx, from, data, protocols)
    }
    
    pub fn query_handle_call_message_accounts<'info>(
        ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
        _from: String,
        data: Vec<u8>,
        _protocols: Vec<String>
    ) -> Result<ParamAccounts>{
        return instructions:: get_handle_call_message_accounts(ctx, data);
        
    }

}
