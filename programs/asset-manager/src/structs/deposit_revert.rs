use anchor_lang::prelude::*;
use rlp::{ Encodable, RlpStream};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DepositRevert {
    pub token_address: String,
    pub account: String,
    pub amount: u64,
}

pub const DEPOSIT_REVERT: &str = "DepositRevert";

// impl Encodable and Decodable for DepositRevert
impl Encodable for DepositRevert {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(4);
        s.append(&DEPOSIT_REVERT);
        s.append(&self.token_address);
        s.append(&self.account);
        s.append(&self.amount);
    }
}

impl DepositRevert {
    pub fn create(
        token_address: String,
        account: String,
        amount: u64,
    ) -> Self {
        Self {
            token_address,
            account,
            amount,
        }
    }
}