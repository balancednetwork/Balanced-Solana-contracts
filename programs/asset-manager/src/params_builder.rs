use anchor_lang::prelude::*;
use crate::{errors::CustomError, helpers::decode_withdraw_to_msg, states::*};
use std::str::FromStr;
 // #[account(mut)]
// pub to: Option<Account<'info, TokenAccount>>,
// #[account(mut)]
// pub to_native: Option<AccountInfo<'info>>,
// pub state: Account<'info, State>,
// #[account(mut)]
// pub vault_token_account: Option<Account<'info, TokenAccount>>,
// #[account(mut, seeds = [b"vault_native", valult_native_authority.clone().unwrap().key().as_ref()], bump)]
// pub vault_native_account: Option<AccountInfo<'info>>,
// #[account(mut)]
// pub mint: Option<Account<'info, Mint>>,

// ///CHECK: not required
// #[account(seeds = [b"vault", mint.clone().unwrap().key().as_ref()], bump)]
// pub valult_authority: Option<AccountInfo<'info>>,
// ///CHECK: not required

// pub valult_native_authority: Option<AccountInfo<'info>>,

// pub token_program: Option<Program<'info, Token>>,
// pub xcall_manager: Program<'info, XcallManager>,
// pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
// pub xcall: Program<'info, XcallManager>,


pub fn get_withdraw_to_token_param<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<Vec<ParamAccountProps>> {
    let mut accounts: Vec<ParamAccountProps>  = Vec::new();

    let message = decode_withdraw_to_msg(&data)?;
    
    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall,
        is_writable: false,
        is_signer: false,
    });
    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall_manager,
        is_writable: false,
        is_signer: false,
    });
    accounts.push(ParamAccountProps{
        pubkey: ctx.accounts.state.xcall_manager_state,
        is_writable: false,
        is_signer: false,
    });
    accounts.push(ParamAccountProps{
        pubkey: Pubkey::from_str(&message.user_address).map_err(|_| CustomError::NotAnAddress)?,
        is_writable: true,
        is_signer: false,
    });
    let mint = Pubkey::from_str(&message.token_address).map_err(|_| CustomError::NotAnAddress)?;
    accounts.push(ParamAccountProps{
        pubkey: mint,
        is_writable: true,
        is_signer: false,
    });
    accounts.push(ParamAccountProps{
        pubkey: get_vault_pda(ctx, mint)?.0,
        is_writable: true,
        is_signer: false,
    });

    Ok(accounts)
}

pub fn get_vault_pda<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, mint: Pubkey) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"vault", mint.as_ref()];
    let (pda, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
    Ok((pda, bump))
}

pub fn get_native_vault_pda<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, mint: Pubkey) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"native_vault", mint.as_ref()];
    let (pda, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
    Ok((pda, bump))
}