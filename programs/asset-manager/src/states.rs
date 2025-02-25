use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token,
    token::{Mint, Token, TokenAccount},
};
use xcall::program::Xcall;
use xcall_manager::{self, program::XcallManager};

use crate::errors::AssetManagerError;
pub const STATE_SEED: &'static [u8; 5] = b"state";
pub const TOKEN_STATE_SEED: &'static [u8; 11] = b"token_state";
pub const VAULT_SEED: &'static [u8; 5] = b"vault";
pub const VAULT_NATIVE_SEED: &'static [u8; 12] = b"vault_native";
pub const TOKEN_CREATION_ACCOUNT_SEED: &'static [u8; 14] = b"token_creation";

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + State::INIT_SPACE, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut, seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(address=state.admin @AssetManagerError::UnauthorizedCaller)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct ConfigureRateLimit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, has_one=admin, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,

    #[account(init_if_needed, payer=admin, space = 8 + TokenState::INIT_SPACE, seeds=[TOKEN_STATE_SEED, token.as_ref()], bump)]
    pub token_state: Account<'info, TokenState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct SetTokenAccountCreationFee<'info> {
    #[account(init, payer = admin, seeds=[TOKEN_CREATION_ACCOUNT_SEED, token.as_ref()], bump, space = 8 + TokenAccountCreationFee::INIT_SPACE)]
    pub token_account_creation_pda: Account<'info, TokenAccountCreationFee>,
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut, address=state.admin @AssetManagerError::UnauthorizedCaller)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}   

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct ResetLimit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub state: Account<'info, State>,

    #[account(mut, seeds=[TOKEN_STATE_SEED, token.as_ref()], bump)]
    pub token_state: Account<'info, TokenState>,
    
}

#[derive(Accounts)]
pub struct GetWithdrawLimit<'info> {
    #[account(
        seeds = [
            TOKEN_STATE_SEED,
            vault_token_account.mint.as_ref()
        ],
        bump,
    )]
    pub token_state: Account<'info, TokenState>,
    pub vault_token_account: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub from: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub from_authority: Signer<'info>,

    #[account(mut, constraint=vault_token_account.owner==valult_authority.clone().unwrap().key() @AssetManagerError::InvalidValultTokenAccount )]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,
    #[account(seeds = [VAULT_SEED, from.clone().unwrap().mint.as_ref()], bump)]
    pub valult_authority: Option<AccountInfo<'info>>,

    #[account(mut, seeds = [VAULT_NATIVE_SEED], bump)]
    pub vault_native_account: Option<AccountInfo<'info>>,
    #[account(mut, seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,

    #[account(constraint=xcall_manager_state.key()==state.xcall_manager_state @AssetManagerError::InvalidXcallManagerState)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,

    pub xcall: Program<'info, Xcall>,
    #[account(
      init_if_needed, payer=from_authority, space = Authority::MAX_SPACE, seeds = [Authority::SEED_PREFIX], bump
    )]
    pub xcall_authority: Account<'info, Authority>,
    //xcall validates this account
    //not additionally used in balanced
    #[account(mut)]
    pub xcall_config: Account<'info, xcall::state::Config>,
    pub xcall_manager: Program<'info, XcallManager>,
    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct State {
    pub xcall: Pubkey,
    #[max_len(100)]
    pub icon_asset_manager: String,
    pub xcall_manager: Pubkey,
    pub xcall_manager_state: Pubkey,
    pub admin: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct TokenAccountCreationFee {
    pub token: Pubkey,
    pub token_account_creation_fee: u64
}

#[account]
#[derive(InitSpace)]
pub struct TokenState {
    pub token: Pubkey,
    pub period: u64,
    pub percentage: u64,
    pub last_update: i64,
    pub current_limit: u64,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(owner=state.xcall @AssetManagerError::OnlyXcall)]
    pub xcall_singer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = to_native
    )]
    pub to: Option<Account<'info, TokenAccount>>,
    /// CHECK: this account is validated inside instruction logic
    #[account(mut)]
    pub to_native: AccountInfo<'info>,
    #[account(seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,
    pub token_state: Account<'info, TokenState>,
    #[account(mut, constraint=vault_token_account.owner==valult_authority.clone().unwrap().key() @AssetManagerError::InvalidValultTokenAccount)]
    pub vault_token_account: Option<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [VAULT_NATIVE_SEED], bump)]
    pub vault_native_account: Option<AccountInfo<'info>>,
    #[account(constraint = mint.key() == token_state.token)]
    pub mint: Option<Account<'info, Mint>>,

    #[account(seeds = [VAULT_SEED, mint.clone().unwrap().key().as_ref()], bump)]
    pub valult_authority: Option<AccountInfo<'info>>,

    pub token_program: Option<Program<'info, Token>>,
    pub associated_token_program: Option<Program<'info, associated_token::AssociatedToken>>,
    pub xcall_manager: Program<'info, XcallManager>,

    #[account(constraint=xcall_manager_state.key()==state.xcall_manager_state @AssetManagerError::InvalidXcallManagerState)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    pub system_program: Program<'info, System>,
    pub admin_token_account: Option<Account<'info, TokenAccount>>,
    #[account(mut, seeds=[TOKEN_CREATION_ACCOUNT_SEED,token_state.token.as_ref()], bump)]
    pub token_account_creation_pda: Option<Account<'info, TokenAccountCreationFee>>,
}

#[derive(Accounts)]
pub struct GetParams<'info> {
    #[account(seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,
}

#[derive(Accounts)]
pub struct ForceRollback<'info> {
    #[account(seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut, address=state.admin @AssetManagerError::UnauthorizedCaller)]
    pub signer: Signer<'info>,
    pub xcall: Program<'info, Xcall>,
    #[account(
      init_if_needed, payer=signer, space = Authority::MAX_SPACE, seeds = [Authority::SEED_PREFIX], bump
    )]
    pub xcall_authority: Account<'info, Authority>,
    pub system_program: Program<'info, System>,
    
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ParamAccountProps {
    pub pubkey: Pubkey,
    pub is_writable: bool,
    pub is_signer: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ParamAccounts {
    pub accounts: Vec<ParamAccountProps>,
}

impl ParamAccountProps {
    pub fn new(pubkey: Pubkey, is_signer: bool) -> Self {
        Self {
            pubkey,
            is_signer,
            is_writable: true,
        }
    }

    pub fn new_readonly(pubkey: Pubkey, is_signer: bool) -> Self {
        Self {
            pubkey,
            is_signer,
            is_writable: false,
        }
    }
}

#[account]
pub struct Authority {
    pub bump: u8,
}

impl Authority {
    pub const SEED_PREFIX: &'static [u8; 14] = b"dapp_authority";
    pub const MAX_SPACE: usize = 8 + 1;
}
