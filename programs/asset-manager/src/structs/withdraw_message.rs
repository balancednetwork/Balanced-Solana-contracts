use anchor_lang::prelude::*;
use rlp::{Encodable, RlpStream};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct WithdrawTo {
    pub token_address: String,
    pub user_address: String,
    pub amount: u128,
}

pub const WITHDRAW_TO: &str = "WithdrawTo";
pub const WITHDRAW_TO_NATIVE: &str = "WithdrawNativeTo";

// impl Encodable and Decodable for WithdrawTo
impl Encodable for WithdrawTo {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(4);
        s.append(&WITHDRAW_TO);
        s.append(&self.token_address);
        s.append(&self.user_address);
        s.append(&self.amount);
    }
}

impl WithdrawTo {
    pub fn create(token_address: String, user_address: String, amount: u128) -> Self {
        Self {
            token_address,
            user_address,
            amount,
        }
    }
}