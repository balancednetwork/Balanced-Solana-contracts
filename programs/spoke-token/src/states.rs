use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token,
    token::{Mint, Token, TokenAccount},
};
use xcall::program::Xcall;
use xcall_manager::{self, program::XcallManager};

use crate::errors::ContractError;
pub const STATE_SEED: &'static [u8; 5] = b"state";
pub const AUTHORITY_SEED: &'static [u8; 15] = b"bnusd_authority";
pub const TOKEN_CREATION_ACCOUNT_SEED: &'static [u8; 14] = b"token_creation";

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, seeds=[STATE_SEED], bump, space = 8 + State::INIT_SPACE)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(address=state.admin @ContractError::OnlyAdmin)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetTokenCreationFee<'info> {
    #[account(init, payer = admin, seeds=[TOKEN_CREATION_ACCOUNT_SEED], bump, space = 8 + TokenAccountCreationFee::INIT_SPACE)]
    pub token_account_creation_pda: Account<'info, TokenAccountCreationFee>,
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut, address=state.admin @ContractError::OnlyAdmin)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrossTransfer<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub from_authority: Signer<'info>,

    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut, constraint=mint.key()==state.spoke_token_addr)]
    pub mint: Account<'info, Mint>,

    #[account(constraint=xcall_manager_state.key() ==state.xcall_manager_state @ContractError::InvalidXcallManagerState)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    //xcall validates this account
    //not additionally used in balanced
    #[account(mut)]
    pub xcall_config: Account<'info, xcall::state::Config>,
    #[account(
        init_if_needed, payer=from_authority, space = Authority::MAX_SPACE, seeds = [Authority::SEED_PREFIX], bump
      )]
    pub xcall_authority: Account<'info, Authority>,
    pub xcall: Program<'info, Xcall>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(owner=state.xcall @ContractError::OnlyXcall)]
    pub xcall_singer: Signer<'info>,
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = to_authority
    )]
    pub to: Account<'info, TokenAccount>,
    /// CHECK: this account is validated inside instruction logic
    pub to_authority: AccountInfo<'info>,

    #[account(mut, constraint=mint.key()==state.spoke_token_addr)]
    pub mint: Account<'info, Mint>,
    ///CHECK: program signs onbehalf of the authority pda
    /// no additional validation is required as mint is already validated separately 
    #[account(seeds = [AUTHORITY_SEED], bump)]
    pub mint_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
    pub xcall_manager: Program<'info, XcallManager>,
    pub xcall: Program<'info, Xcall>,

    #[account(constraint=xcall_manager_state.key()==state.xcall_manager_state @ContractError::InvalidXcallManagerState)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    pub system_program: Program<'info, System>,

    ///CHECK: validated in logic
    pub admin: Option<AccountInfo<'info>>,
    #[account(mut, seeds=[TOKEN_CREATION_ACCOUNT_SEED], bump)]
    pub token_account_creation_pda: Option<Account<'info, TokenAccountCreationFee>>,

}

#[account]
#[derive(InitSpace)]
pub struct State {
    pub xcall: Pubkey,
    pub admin: Pubkey,
    #[max_len(100)]
    pub icon_hub_addr: String,
    pub xcall_manager: Pubkey,
    pub spoke_token_addr: Pubkey,
    pub xcall_manager_state: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct TokenAccountCreationFee {
    pub token_account_creation_fee: u64
}


#[derive(Accounts)]
pub struct GetParams<'info> {
    #[account(seeds=[STATE_SEED], bump)]
    pub state: Account<'info, State>,
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

#[derive(Accounts)]
pub struct ForceRollback<'info> {
    #[account(seeds = [STATE_SEED], bump)]
    pub state: Account<'info, State>,
    #[account(mut, address=state.admin @ContractError::OnlyAdmin)]
    pub signer: Signer<'info>,
    pub xcall: Program<'info, Xcall>,
    #[account(
      init_if_needed, payer=signer, space = Authority::MAX_SPACE, seeds = [Authority::SEED_PREFIX], bump
    )]
    pub xcall_authority: Account<'info, Authority>,
    pub system_program: Program<'info, System>,
    
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
