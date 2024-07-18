use rlp::{DecoderError, Rlp};

use crate::{errors::AssetManagerError, structs::{deposit_revert::{DepositRevert, DEPOSIT_REVERT}, withdraw_message::{WithdrawTo, WITHDRAW_TO, WITHDRAW_TO_NATIVE}}};



pub enum WithdrawToStruct {
    WithdrawTo(WithdrawTo),
}

pub enum DepositRevertDecodedStruct {
    DepositRevert(DepositRevert),
}

pub fn decode_method(data: &[u8]) -> std::result::Result<String, DecoderError> {
    let rlp: Rlp = Rlp::new(data);

    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();

    Ok(method)

}

pub fn decode_withdraw_to_msg(data: &[u8]) -> std::result::Result<WithdrawTo, AssetManagerError> {
    let rlp = Rlp::new(data);

    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    if rlp.item_count()? != 4 {
        return Err(DecoderError::RlpInvalidLength.into());
    }

    let token: String = rlp.val_at(1)?;
    let user_address: String = rlp.val_at(2)?;
    let amount: u128 = rlp.val_at(3)?;

    let withdraw_to = WithdrawTo {
        token_address: token,
        user_address,
        amount,
    };

    Ok(withdraw_to)
       
}

pub fn decode_deposit_revert_msg(data: &[u8]) -> std::result::Result<DepositRevert, AssetManagerError> {
    let rlp = Rlp::new(data);
    if !rlp.is_list() {
        return Err(DecoderError::RlpExpectedToBeList.into());
    }

    let method: String = rlp.val_at(0).unwrap();
    if method != DEPOSIT_REVERT {
        return Err(DecoderError::RlpInvalidLength.into());
    }
    let token_address = rlp.val_at(1)?;
    let account: String = rlp.val_at(2)?;
    let amount: u64 = rlp.val_at(3)?;

    let deposit_revert: DepositRevert = DepositRevert {
        token_address,
        account,
        amount,
    };
    Ok(deposit_revert)
}