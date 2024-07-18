use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use xcall::program::Xcall;
use xcall_manager::{self, program::XcallManager};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, seeds=["config".as_bytes()], bump, space = 8 + State::INIT_SPACE)]
    pub balanced_dollar: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrossTransfer<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    ///CHECK: will be validated inside the method
    #[account(mut, seeds = [b"balanced_dollar"], bump)]
    pub balanced_dollar: AccountInfo<'info>,
    pub xcall: Program<'info, Xcall>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    #[account(mut)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(seeds = [b"bnusd_authority", mint.key().as_ref()], bump)]
    pub mint_authority: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub xcall_manager: Program<'info, XcallManager>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    pub system_program: Program<'info, System>,
}


#[account]
#[derive(InitSpace)]
pub struct State {
    pub xcall: Pubkey,
    #[max_len(50)]
    pub icon_bn_usd: String,
    pub xcall_manager: Pubkey,
    pub bn_usd_token: Pubkey,
    pub owner: Pubkey,
}
