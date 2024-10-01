use anchor_lang::prelude::*;

use crate::{errors::XCallManagerError, program::XcallManager};

pub const STATE_SEED: &'static [u8; 5] = b"state";

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, seeds=[STATE_SEED], bump, space = 8 + XmState::INIT_SPACE)]
    pub state: Account<'info, XmState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct XmState {
    pub admin: Pubkey,
    pub xcall: Pubkey,
    #[max_len(50)]
    pub icon_governance: String,
    #[max_len(5, 50)]
    pub sources: Vec<String>,
    #[max_len(5, 50)]
    pub destinations: Vec<String>,
    #[max_len(5, 500)]
    pub whitelisted_actions: Vec<Vec<u8>>,
    #[max_len(50)]
    pub proposed_protocol_to_remove: String,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut, seeds=[STATE_SEED], bump, has_one=admin)]
    pub state: Account<'info, XmState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetProtocols<'info> {
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, XmState>,
    #[account(address = crate::ID)]
    pub program: Program<'info, XcallManager>,
    pub signer: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Protocols {
    pub sources: Vec<String>,
    pub destinations: Vec<String>,
}

#[derive(Accounts)]
pub struct VerifyProtocols<'info> {
    #[account(seeds=[STATE_SEED], bump)]
    pub state: Account<'info, XmState>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    pub signer: Signer<'info>,
    #[account(owner=state.xcall @XCallManagerError::OnlyXcall)]
    pub xcall_singer: Signer<'info>,

    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, XmState>,
}

#[derive(Accounts)]
pub struct GetParams<'info> {
    #[account(mut, seeds=[STATE_SEED], bump)]
    pub state: Account<'info, XmState>,
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
