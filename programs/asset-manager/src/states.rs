use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount};
use xcall::program::Xcall;
use xcall_manager::{self, program::XcallManager};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + State::INIT_SPACE, seeds=[b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct ConfigureRateLimit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, seeds=[b"state"], bump)]
    pub state: Account<'info, State>,

    #[account(init_if_needed, payer=admin, space = 8 + TokenState::INIT_SPACE, seeds=[b"token_state", token.as_ref()], bump)]
    pub token_state: Account<'info, TokenState>,

    #[account(mut, has_one = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>, // This ensures vault_token_account is for the specified token
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct ResetLimit<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub state: Account<'info, State>,

    #[account(mut, seeds=[b"token_state", token.as_ref()], bump)]
    pub token_state: Account<'info, TokenState>,

    #[account(mut, has_one = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>
}

#[derive(Accounts)]
#[instruction(token: Pubkey)]
pub struct GetWithdrawLimit<'info> {
    #[account()]
    pub token_state: Account<'info, TokenState>,
    #[account(mut, has_one = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>
}

#[derive(Accounts)]
pub struct DepositToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Option<Program<'info, Token>>,
    pub mint: Option<Account<'info, Mint>>,
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut, has_one = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,

    /// CHECK: xcall_manager_state is validated in the method
    #[account(mut, seeds = [b"asset_manager_signer"], bump)]
    pub asset_manager: AccountInfo<'info>,
    pub xcall: Program<'info, Xcall>,
    pub xcall_manager: Program<'info, XcallManager>,

    pub system_program: Program<'info, System>
}

// #[derive(Accounts)]
// pub struct DepositNative<'info> {
//     #[account(mut)]
//     pub user: Signer<'info>,
//     pub vault_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub state: Account<'info, State>,
    
// }

#[account]
#[derive(InitSpace)]
pub struct State {
    pub xcall: Pubkey,
    #[max_len(50)]
    pub icon_asset_manager: String,
    pub xcall_manager: Pubkey,
    pub admin: Pubkey,
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
    pub state: Account<'info, State>,
    #[account(mut, has_one = mint)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub mint: Option<Account<'info, Mint>>,
    pub token_program: Option<Program<'info, Token>>,
    pub xcall_manager: Program<'info, XcallManager>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    /// CHECK: xcall_manager_state is validated in the method
    #[account(mut, seeds = [b"asset_manager_signer"], bump)]
    pub asset_manager: AccountInfo<'info>,
    pub to_address: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[account]
pub struct Asset {
    pub asset_type: AssetType,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AssetType {
    Native,
    Token,
}


