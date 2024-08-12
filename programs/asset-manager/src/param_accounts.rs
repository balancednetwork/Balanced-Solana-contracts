use anchor_lang::{prelude::*, solana_program::{self, sysvar}};
use crate::{errors::*, helpers::{decode_deposit_revert_msg, decode_withdraw_to_msg}, states::*};
use std::str::FromStr;
use anchor_spl::{associated_token::get_associated_token_address, token::ID as TOKEN_PROGRAM_ID};
use solana_program::system_program::ID as SYSTEM_PROGRAM_ID;

pub fn get_spl_token_withdraw_to_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<Vec<ParamAccountProps>> {
    let message = decode_withdraw_to_msg(&data)?;
    let user_address = Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let mint = Pubkey::from_str(&message.token_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let vault_account = get_associated_token_address(&get_vault_pda(&ctx, mint)?.0, &mint);
    
    let accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(vault_account, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(mint, false),
        ParamAccountProps::new(get_vault_pda(&ctx, mint)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false)
    ];
    
    Ok(accounts)
}

pub fn get_spl_token_deposit_revert_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<Vec<ParamAccountProps>> {
    let message = decode_deposit_revert_msg(&data)?;
    let user_address = Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
    let mint = Pubkey::from_str(&message.token_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let vault_account = get_associated_token_address(&get_vault_pda(&ctx, mint)?.0, &mint);
    let accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(vault_account, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(mint, false),
        ParamAccountProps::new(get_vault_pda(&ctx, mint)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false)
    ];
    
    Ok(accounts)
}

pub fn get_native_token_withdraw_to_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<Vec<ParamAccountProps>> {
    let message = decode_withdraw_to_msg(&data)?;
    let user_address = Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new(*ctx.program_id, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(get_native_vault_pda(&ctx)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false)
    ];
    
    Ok(accounts)
}

pub fn get_native_token_deposit_revert_accounts<'info>(ctx: Context<'_, '_, '_, 'info, GetParams<'info>>, data: Vec<u8>) -> Result<Vec<ParamAccountProps>> {
    let message: crate::structs::deposit_revert::DepositRevert = decode_deposit_revert_msg(&data)?;
    let user_address = Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
    
    let accounts: Vec<ParamAccountProps>  = vec![
        ParamAccountProps::new(sysvar::instructions::id(), false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(get_native_vault_pda(&ctx)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false)
    ];
    
    Ok(accounts)
}

pub fn get_vault_pda<'info>(ctx: &Context<'_, '_, '_, 'info, GetParams<'info>>, mint: Pubkey) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"vault", mint.as_ref()];
    let (pda, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
    Ok((pda, bump))
}

pub fn get_native_vault_pda<'info>(ctx: &Context<'_, '_, '_, 'info, GetParams<'info>>) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"vault_native"];
    let (pda, bump) = Pubkey::find_program_address(seeds, ctx.program_id);
    Ok((pda, bump))
}

