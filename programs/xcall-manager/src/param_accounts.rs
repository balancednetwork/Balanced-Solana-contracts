use anchor_lang::prelude::*;
use crate::states::*;
use crate::query_account_types;


pub fn get_configure_protocols_param<'info>(ctx: Context<'_, '_, '_, 'info, GetAccounts<'info>>) -> Result<Vec<ParamAccountProps>> {
    let mut accounts: Vec<ParamAccountProps>  = Vec::new();

    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall,
        is_writable: false,
        is_signer: false,
    });
    

    Ok(accounts)
}
