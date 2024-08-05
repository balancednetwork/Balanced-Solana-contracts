use rlp::{DecoderError, Rlp};

use crate::{errors::BalancedDollarError, structs::{cross_transfer::{CrossTransferMsg, CROSS_TRANSFER}, cross_transfer_revert::{CrossTransferRevert, CROSS_TRANSFER_REVERT}}};


pub fn decode_method(data: &[u8]) -> std::result::Result<String, DecoderError> {
    let rlp = Rlp::new(data);

    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();

    Ok(method)

}

pub fn decode_cross_transfer(data: &[u8]) -> std::result::Result<CrossTransferMsg, BalancedDollarError> {
    // Decode RLP bytes into an Rlp object
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }
    let method: String = rlp.val_at(0).unwrap();
    if method != CROSS_TRANSFER {
        return Err(DecoderError::RlpInvalidLength.into());
    }
   
    if rlp.item_count()? != 5 {
        return Err(DecoderError::RlpInvalidLength.into());
    }
    let from: String = rlp.val_at(1)?;
    let to: String = rlp.val_at(2)?;
    let value: u64 = rlp.val_at(3)?;
    let data: Vec<u8> = rlp.at(4)?.data()?.to_vec();
    let cross_transfer = CrossTransferMsg {
        from,
        to,
        value,
        data
    };
    Ok(cross_transfer)
}

pub fn decode_cross_transfer_revert(data: &[u8]) -> std::result::Result<CrossTransferRevert, BalancedDollarError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    if method != CROSS_TRANSFER_REVERT {
        return Err(DecoderError::RlpInvalidLength.into());
    }
    let account: String = rlp.val_at(1)?;
    let amount: u64 = rlp.val_at(2)?;

    let cross_transfer_revert: CrossTransferRevert = CrossTransferRevert {
        account,
        amount,
    };
    Ok(cross_transfer_revert)
}