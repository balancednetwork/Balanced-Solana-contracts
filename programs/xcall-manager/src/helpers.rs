use rlp::{DecoderError, Rlp};

use crate::{errors::XCallManagerError, states::Protocols};

pub const CONFIGURE_PROTOCOLS: &str = "ConfigureProtocols";


pub fn decode_method(data: &[u8]) -> std::result::Result<String, XCallManagerError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    Ok(method)
}

pub fn decode_execute_call_msg(data: &[u8]) -> std::result::Result<Protocols, XCallManagerError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    if method != CONFIGURE_PROTOCOLS {
        return Err(DecoderError::RlpInvalidLength.into());
    }
    // let sources = rlp.val_at(1)?;
    // let destinations = rlp.val_at(2)?;

    let sources = vec!["sources".to_string()];
    let destinations = vec!["destinations".to_string()];

    let protocols: Protocols = Protocols {
        sources,
        destinations,
    };
    Ok(protocols)
}