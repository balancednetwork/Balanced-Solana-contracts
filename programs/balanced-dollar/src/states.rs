use anchor_lang::{prelude::*, solana_program::sysvar};
use anchor_spl::token::{Token, TokenAccount, Mint};
use xcall::program::Xcall;
use xcall_manager::{self, program::XcallManager};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, seeds=[b"state"], bump, space = 8 + State::INIT_SPACE)]
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
    // #[account(mut)]
    // pub to: Option<Account<'info, TokenAccount>>,
    #[account(mut, seeds=[b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
    #[account(mut)]
    pub xcall_config: Account<'info, xcall::state::Config>,

    pub xcall: Program<'info, Xcall>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    pub signer: Signer<'info>,
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::instructions::id())]
    pub instruction_sysvar: UncheckedAccount<'info>,
    pub state: Account<'info, State>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    ///CHECK: validated in the method
    #[account(seeds = [b"bnusd_authority"], bump)]
    pub mint_authority: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub xcall_manager: Program<'info, XcallManager>,
    pub xcall: Program<'info, Xcall>,
    #[account(mut)]
    pub xcall_manager_state: Account<'info, xcall_manager::XmState>,
}


#[account]
#[derive(InitSpace)]
pub struct State {
    pub xcall: Pubkey,
    #[max_len(100)]
    pub icon_bn_usd: String,
    pub xcall_manager: Pubkey,
    pub bn_usd_token: Pubkey,
    pub xcall_manager_state: Pubkey,
}

#[derive(Accounts)]
pub struct GetParams<'info> {
    pub state: Account<'info, State>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ParamAccountProps{
    pub pubkey: Pubkey,
    pub is_writable: bool,
    pub is_signer: bool
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ParamAccounts{
    pub accounts: Vec<ParamAccountProps>
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