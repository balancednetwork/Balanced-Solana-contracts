
use anchor_lang::prelude::*;
use rlp::{Encodable, RlpStream};

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, PartialEq, Clone)]
pub struct DepositMessage {
    pub token_address: String,
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub data: Vec<u8>,
}

pub const DEPOSIT: &str = "Deposit";

// impl Encodeable and Decodeable
impl Encodable for DepositMessage {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(6);
        s.append(&DEPOSIT);
        s.append(&self.token_address);
        s.append(&self.from);
        s.append(&self.to);
        s.append(&self.amount);
        s.append(&self.data);
    }
}

impl DepositMessage {
    pub fn create(
        token_address: String,
        from: String,
        to: String,
        amount: u64,
        data: Vec<u8>,
    ) -> Self {
        Self {
            token_address,
            from,
            to,
            amount,
            data,
        }
    }

    pub fn null() -> Self {
        Self {
            token_address: String::new(),
            from: String::new(),
            to: String::new(),
            amount: 0,
            data: vec![],
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }
}
