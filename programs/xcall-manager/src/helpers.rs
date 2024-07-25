use rlp::{DecoderError, Rlp};

use crate::{errors::XCallManagerError, configure_protocols::ConfigureProtocols};

pub const CONFIGURE_PROTOCOLS: &str = "ConfigureProtocols";


pub fn decode_method(data: &[u8]) -> std::result::Result<String, XCallManagerError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    Ok(method)
}

pub fn decode_handle_call_msg(data: &[u8]) -> std::result::Result<ConfigureProtocols, XCallManagerError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    if method != CONFIGURE_PROTOCOLS {
        return Err(DecoderError::RlpInvalidLength.into());
    }

    Ok(ConfigureProtocols {
            sources: rlp.list_at::<String>(1)?,
            destinations: rlp.list_at::<String>(2)?,
        })
}