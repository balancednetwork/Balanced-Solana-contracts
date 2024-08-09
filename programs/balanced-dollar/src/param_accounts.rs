use anchor_lang::{prelude::*, solana_program::sysvar};
use crate::states::*;
use anchor_spl::token::ID as TOKEN_PROGRAM_ID;

pub fn get_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, to: Pubkey) -> Result<Vec<ParamAccountProps>> {
    let  accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new(ctx.accounts.state.key(), false),
        ParamAccountProps::new(to, false),
        ParamAccountProps::new(ctx.accounts.state.bn_usd_token, false),
        ParamAccountProps::new(mint_authority(&ctx)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall, false),
        ParamAccountProps::new(ctx.accounts.state.xcall_manager_state, false),
    ];
    Ok(accounts)
}

pub fn mint_authority<'info>(ctx: &Context<'_, '_, '_, 'info, GetParams<'info>>) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"bnusd_authority"];
    let (pda, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
    Ok((pda, bump))
}