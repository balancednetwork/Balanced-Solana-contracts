use anchor_lang::prelude::*;
use rlp::{Decodable, DecoderError, Encodable, Rlp, RlpStream};


#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, PartialEq, Clone)]
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
        s.begin_list(3);
        s.append(&WITHDRAW_TO);
        s.append(&self.token_address);
        s.append(&self.user_address);
        s.append(&self.amount);
    }
}

impl Decodable for WithdrawTo {
    fn decode(rlp: &Rlp) -> std::result::Result<Self, DecoderError> {
        if rlp.item_count()? != 3 {
            return Err(DecoderError::RlpIncorrectListLen);
        }

        Ok(WithdrawTo {
            token_address: rlp.at(0)?.as_val()?,
            user_address: rlp.at(1)?.as_val()?,
            amount: rlp.at(2)?.as_val()?,
        })
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

    pub fn null() -> Self {
        Self {
            token_address: String::new(),
            user_address: String::new(),
            amount: 0,
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }
}

// #[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, PartialEq, Clone)]
// pub struct WithdrawNativeTo {
//     pub token_address: String,
//     pub user_address: String,
//     pub amount: u128,
// }

// // impl Encodable and Decodable for WithdrawNativeTo
// impl Encodable for WithdrawNativeTo {
//     fn rlp_append(&self, s: &mut RlpStream) {
//         s.begin_list(3);
//         s.append(&self.token_address);
//         s.append(&self.user_address);
//         s.append(&self.amount);
//     }
// }

// impl Decodable for WithdrawNativeTo {
//     fn decode(rlp: &Rlp) -> std::result::Result<Self, DecoderError> {
//         if rlp.item_count()? != 3 {
//             return Err(DecoderError::RlpIncorrectListLen);
//         }

//         Ok(WithdrawNativeTo {
//             token_address: rlp.at(0)?.as_val()?,
//             user_address: rlp.at(1)?.as_val()?,
//             amount: rlp.at(2)?.as_val()?,
//         })
//     }
// }

// impl WithdrawNativeTo {
//     pub fn create(token_address: String, user_address: String, amount: u128) -> Self {
//         Self {
//             token_address,
//             user_address,
//             amount,
//         }
//     }

//     pub fn null() -> Self {
//         Self {
//             token_address: String::new(),
//             user_address: String::new(),
//             amount: 0,
//         }
//     }

//     pub fn encode(&self) -> Vec<u8> {
//         rlp::encode(&self.clone()).to_vec()
//     }
// }