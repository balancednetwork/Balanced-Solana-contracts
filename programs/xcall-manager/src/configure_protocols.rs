use anchor_lang::prelude::*;
use rlp::{Decodable, DecoderError, Encodable, Rlp, RlpStream};

use crate::errors::XCallManagerError;

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, PartialEq, Clone)]
pub struct ConfigureProtocols {
    pub sources: Vec<String>,
    pub destinations: Vec<String>,
}

pub const CONFIGURE_PROTOCOLS: &str = "ConfigureProtocols";

// Implement Encodable and Decodable for ConfigureProtocols
impl Encodable for ConfigureProtocols {
    fn rlp_append(&self, s: &mut RlpStream) {
        s.begin_list(3);  // Corrected the number of items to 3
        s.append(&CONFIGURE_PROTOCOLS);
        s.append_list::<String, _>(&self.sources);
        s.append_list::<String, _>(&self.destinations);
    }
}

impl Decodable for ConfigureProtocols {
    fn decode(rlp: &Rlp) -> std::result::Result<Self, DecoderError> {
        if rlp.item_count()? != 3 {  // Corrected the expected item count to 3
            return Err(DecoderError::RlpIncorrectListLen);
        }
        let protocol: String = rlp.val_at(0)?;
        if protocol != CONFIGURE_PROTOCOLS {
            return Err(DecoderError::Custom("Unexpected protocol string".into()));
        }

        Ok(ConfigureProtocols {
            sources: rlp.list_at::<String>(1)?,
            destinations: rlp.list_at::<String>(2)?,
        })
    }
}

impl ConfigureProtocols {
    pub fn create(
        sources: Vec<String>,
        destinations: Vec<String>,
    ) -> Self {
        Self {
            sources,
            destinations,
        }
    }

    pub fn null() -> Self {
        Self {
            sources: vec![],
            destinations: vec![],
        }
    }

    pub fn encode(&self) -> Vec<u8> {
        rlp::encode(&self.clone()).to_vec()
    }

    pub fn decode_from(data: &[u8]) -> std::result::Result<Self, XCallManagerError> {
        let rlp = Rlp::new(data);

        ConfigureProtocols::decode(&rlp).map_err(|_| XCallManagerError::DecoderError)
    }
}