use crate::{
    errors::*,
    helpers::{decode_deposit_revert_msg, decode_withdraw_to_msg},
    states::*,
    instructions::_NATIVE_ADDRESS,
    id
};
use anchor_lang::{prelude::*, solana_program};
use anchor_spl::{associated_token::{get_associated_token_address, self}, token::ID as TOKEN_PROGRAM_ID};
use solana_program::system_program::ID as SYSTEM_PROGRAM_ID;
use std::str::FromStr;

pub fn get_spl_token_withdraw_to_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    data: Vec<u8>,
) -> Result<Vec<ParamAccountProps>> {
    let message = decode_withdraw_to_msg(&data)?;
    let user_address =
        Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let mint =
        Pubkey::from_str(&message.token_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let user_token_address = get_associated_token_address(&user_address, &mint);
    let vault_account = get_associated_token_address(&get_vault_pda(&ctx.program_id, mint)?.0, &mint);
    let admin_token_address = get_associated_token_address(&ctx.accounts.state.admin, &mint);

    let (token_account_creation_pda,_) = Pubkey::find_program_address(&[TOKEN_CREATION_ACCOUNT_SEED, mint.as_ref()], &id());

    let accounts: Vec<ParamAccountProps> = vec![
        ParamAccountProps::new(user_token_address, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(get_token_state_pda(&ctx.program_id, mint)?.0, false),
        ParamAccountProps::new(vault_account, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(mint, false),
        ParamAccountProps::new(get_vault_pda(&ctx.program_id, mint)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(associated_token::ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false),
        ParamAccountProps::new(admin_token_address, false),
        ParamAccountProps::new(token_account_creation_pda, false),
    ];

    Ok(accounts)
}

pub fn get_spl_token_deposit_revert_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    data: Vec<u8>,
) -> Result<Vec<ParamAccountProps>> {
    let message = decode_deposit_revert_msg(&data)?;
    let user_address =
        Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
    let mint =
        Pubkey::from_str(&message.token_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let user_token_address = get_associated_token_address(&user_address, &mint);
    let vault_account = get_associated_token_address(&get_vault_pda(&ctx.program_id, mint)?.0, &mint);
    let accounts: Vec<ParamAccountProps> = vec![
        ParamAccountProps::new(user_token_address, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(get_token_state_pda(&ctx.program_id, mint)?.0, false),
        ParamAccountProps::new(vault_account, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(mint, false),
        ParamAccountProps::new(get_vault_pda(&ctx.program_id, mint)?.0, false),
        ParamAccountProps::new(TOKEN_PROGRAM_ID, false),
        ParamAccountProps::new_readonly(associated_token::ID, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false),
        ParamAccountProps::new(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
    ];

    Ok(accounts)
}

pub fn get_native_token_withdraw_to_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    data: Vec<u8>,
) -> Result<Vec<ParamAccountProps>> {
    let message = decode_withdraw_to_msg(&data)?;
    let user_address =
        Pubkey::from_str(&message.user_address).map_err(|_| AssetManagerError::NotAnAddress)?;
    let native_mint = Pubkey::from_str(_NATIVE_ADDRESS).map_err(|_| AssetManagerError::NotAnAddress)?;
    let accounts: Vec<ParamAccountProps> = vec![
        ParamAccountProps::new(*ctx.program_id, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(get_token_state_pda(&ctx.program_id, native_mint)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(get_native_vault_pda(&ctx.program_id)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false),
        ParamAccountProps::new(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
    ];

    Ok(accounts)
}

pub fn get_native_token_deposit_revert_accounts<'info>(
    ctx: Context<'_, '_, '_, 'info, GetParams<'info>>,
    data: Vec<u8>,
) -> Result<Vec<ParamAccountProps>> {
    let message: crate::structs::deposit_revert::DepositRevert = decode_deposit_revert_msg(&data)?;
    let user_address =
        Pubkey::from_str(&message.account).map_err(|_| AssetManagerError::NotAnAddress)?;
        let native_mint = Pubkey::from_str(_NATIVE_ADDRESS).map_err(|_| AssetManagerError::NotAnAddress)?;
    let accounts: Vec<ParamAccountProps> = vec![
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(user_address, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.key(), false),
        ParamAccountProps::new(get_token_state_pda(&ctx.program_id, native_mint)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new(get_native_vault_pda(&ctx.program_id)?.0, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager, false),
        ParamAccountProps::new_readonly(ctx.accounts.state.xcall_manager_state, false),
        ParamAccountProps::new(SYSTEM_PROGRAM_ID, false),
        ParamAccountProps::new(*ctx.program_id, false),
        ParamAccountProps::new_readonly(*ctx.program_id, false),
    ];

    Ok(accounts)
}

pub fn get_vault_pda<'info>(
    program_id: &Pubkey,
    mint: Pubkey,
) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"vault", mint.as_ref()];
    let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
    Ok((pda, bump))
}

pub fn get_native_vault_pda<'info>(
    program_id: &Pubkey,
) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"vault_native"];
    let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
    Ok((pda, bump))
}

pub fn get_token_state_pda<'info>(
    program_id: &Pubkey,
    mint: Pubkey
) -> Result<(Pubkey, u8)> {
    let seeds: &[&[u8]] = &[b"token_state", mint.as_ref()];
    let (pda, bump) = Pubkey::find_program_address(seeds, program_id);
    Ok((pda, bump))
}
