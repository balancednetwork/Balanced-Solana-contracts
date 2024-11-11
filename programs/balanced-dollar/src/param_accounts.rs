use crate::states::*;
use anchor_lang::{prelude::*, solana_program::system_program};
use anchor_spl::{associated_token, token::ID as TOKEN_PROGRAM_ID};

pub fn get_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    to_authority: Pubkey,
    to: Pubkey,
) -> Result<Vec<ParamAccountProps>> {
    let accounts: Vec<ParamAccountProps> = vec![
        ParamAccountProps::new(ctx.accounts.state.key(), false),
        ParamAccountProps::new(to, false),
        ParamAccountProps::new_readonly(to_authority, false),
        ParamAccountProps::new(ctx.accounts.state.bn_usd_token, false),
        ParamAccountProps::new(mint_authority(&ctx.program_id)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(associated_token::ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall, false),
        ParamAccountProps::new(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new_readonly(system_program::id(), false),
    ];
    Ok(accounts)
}

pub fn mint_authority<'info>(
    program_id: &Pubkey
) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"bnusd_authority"];
    let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
    Ok((pda, bump))
}
