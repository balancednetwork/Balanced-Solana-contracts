use anchor_lang::prelude::*;
use rlp::{Decodable, DecoderError, Encodable, Rlp, RlpStream};

use crate::errors::BalancedDollarError;
#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, PartialEq, Clone)]
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

impl Decodable for CrossTransferRevert {
    fn decode(rlp: &Rlp) -> std::result::Result<Self, DecoderError> {
        if rlp.item_count()? != 4 {
            return Err(DecoderError::RlpIncorrectListLen);
        }

        Ok(CrossTransferRevert {
            account: rlp.at(1)?.as_val()?,
            amount: rlp.at(2)?.as_val()?,
        })
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

    pub fn null() -> Self {
        Self {
            account: String::new(),
            amount: 0,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }

    pub fn decode_from(data: &[u8]) -> std::result::Result<Self, BalancedDollarError> {
        let rlp = Rlp::new(data);

        CrossTransferRevert::decode(&rlp).map_err(|_| BalancedDollarError::DecoderError)
        
    }
}