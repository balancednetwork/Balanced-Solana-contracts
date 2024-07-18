use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
     #[account(init, payer = admin, seeds=["state".as_bytes()], bump, space = 8 + XmState::INIT_SPACE)]
     pub state: Account<'info, XmState>,
     #[account(mut)]
     pub admin: Signer<'info>,
     pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
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
    #[account(mut, seeds=["state".as_bytes()], bump)]
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
    #[account(mut)]
    pub state: Account<'info, XmState>,
}