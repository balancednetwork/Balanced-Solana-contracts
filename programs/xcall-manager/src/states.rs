use anchor_lang::{prelude::*, solana_program::sysvar};

use crate::errors::XCallManagerError;

#[derive(Accounts)]
pub struct Initialize<'info> {
     #[account(init, payer = admin, seeds=["state".as_bytes()], bump, space = 8 + XmState::INIT_SPACE)]
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
     #[max_len(50, 50)]
     pub whitelisted_actions: Vec<Vec<u8>>,
     #[max_len(50)]
     pub proposed_protocol_to_remove: String,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(mut, seeds=["state".as_bytes()], bump, has_one=admin)]
    pub state: Account<'info, XmState>,
    pub admin: Signer<'info>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Protocols {
    pub sources: Vec<String>,
    pub destinations: Vec<String>,
}

#[derive(Accounts)]
pub struct VerifyProtocols<'info> {
    pub state: Account<'info, XmState>,
}

#[derive(Accounts)]
pub struct HandleCallMessage<'info> {
    pub signer: Signer<'info>,
    #[account(owner=state.xcall @XCallManagerError::OnlyXcall)]
    pub xcall_singer: Signer<'info>,
    /// CHECK: account constraints checked in account trait
    // #[account(address = sysvar::instructions::id())]
    // pub instruction_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub state: Account<'info, XmState>,
}

#[derive(Accounts)]
pub struct GetParams<'info> {
    pub state: Account<'info, XmState>,
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
