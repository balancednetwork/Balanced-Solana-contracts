use anchor_lang::prelude::*;
use rlp::{ Encodable, RlpStream};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CrossTransferRevert{
    pub account: String,
    pub amount: u64,
}

pub const CROSS_TRANSFER_REVERT: &str = "xCrossTransferRevert";

// impl Encodable and Decodable for DepositRevert
impl Encodable for CrossTransferRevert {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(3);
        s.append(&CROSS_TRANSFER_REVERT);
        s.append(&self.account);
        s.append(&self.amount);
    }
}

impl CrossTransferRevert {
    pub fn create(
        account: String,
        amount: u64,
    ) -> Self {
        Self {
            account,
            amount,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }
}