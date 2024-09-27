use anchor_lang::prelude::*;
use rlp::{Encodable, RlpStream};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CrossTransferMsg {
    pub from: String,
    pub to: String,
    pub value: u128,
    pub data: Vec<u8>,
}

pub const CROSS_TRANSFER: &str = "xCrossTransfer";

// impl Encodeable and Decodeable
impl Encodable for CrossTransferMsg {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(5);
        s.append(&CROSS_TRANSFER);
        s.append(&self.from);
        s.append(&self.to);
        s.append(&self.value);
        s.append(&self.data);
    }
}

impl CrossTransferMsg {
    pub fn create(from: String, to: String, value: u128, data: Vec<u8>) -> Self {
        Self {
            from,
            to,
            value,
            data,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }
}
