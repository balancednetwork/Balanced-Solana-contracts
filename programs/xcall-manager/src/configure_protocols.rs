use anchor_lang::prelude::*;
use rlp::{Encodable, RlpStream};


#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
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
}