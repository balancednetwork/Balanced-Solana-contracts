
use anchor_lang::prelude::*;
use rlp::{Decodable, DecoderError, Encodable, Rlp, RlpStream};

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

impl Decodable for DepositMessage {
    fn decode(rlp: &Rlp) -> std::prelude::v1::Result<Self, DecoderError> {

        if rlp.item_count()? != 5 {
            return Err(DecoderError::RlpIncorrectListLen);
        }

        Ok(DepositMessage {
            token_address: rlp.at(1)?.as_val()?,
            from: rlp.at(2)?.as_val()?,
            to: rlp.at(3)?.as_val()?,
            amount: rlp.at(4)?.as_val()?,
            data: rlp.at(5)?.data()?.to_vec(),
        })
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
