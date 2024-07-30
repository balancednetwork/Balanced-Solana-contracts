use anchor_lang::prelude::*;
use crate::states::*;


pub fn get_cross_transfer_param<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>) -> Result<Vec<ParamAccountProps>> {
    let mut accounts: Vec<ParamAccountProps>  = Vec::new();

    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall,
        is_writable: false,
        is_signer: false,
    });
    
    Ok(accounts)
}

pub fn get_handle_call_msg_param<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>) -> Result<Vec<ParamAccountProps>> {
    let mut accounts: Vec<ParamAccountProps>  = Vec::new();

    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall,
        is_writable: false,
        is_signer: false,
    });

    Ok(accounts)
}
