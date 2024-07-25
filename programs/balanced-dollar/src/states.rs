use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};
use xcall_manager::{self, program::XcallManager};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, seeds=["state".as_bytes()], bump, space = 8 + State::INIT_SPACE)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CrossTransfer<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub from_authority: Signer<'info>,
    #[account(mut)]
    pub to: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    
    pub xcall: Program<'info, XcallManager>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    pub state: Account<'info, State>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    ///CHECK: no need
    #[account(seeds = [b"bnusd_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub xcall_manager: Program<'info, XcallManager>,
    pub xcall: Program<'info, XcallManager>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
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
