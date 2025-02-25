use anchor_lang::prelude::*;
use rlp::DecoderError;

#[error_code]
pub enum ContractError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid protocols")]
    InvalidProtocols,
    #[msg("Invalid sender")]
    InvalidSender,
    #[msg("Unknown message type")]
    UnknownMessageType,
    #[msg("Method Decode Error")]
    DecoderError,
    #[msg("Not Spoke Token")]
    NotSpokeToken,
    #[msg("Not the xcall program")]
    NotXcall,
    #[msg("Insufficient Balance")]
    InsufficientBalance,
    #[msg("Not an address")]
    NotAnAddress,
    #[msg["Invalid Network Address"]]
    InvalidNetworkAddress,
    #[msg["Only Xcall"]]
    OnlyXcall,
    #[msg["Only Admin"]]
    OnlyAdmin,
    #[msg["Invalid xcall manager state"]]
    InvalidXcallManagerState,
    #[msg["Invalid to address"]]
    InvalidToAddress,
    #[msg["Invalid Admin"]]
    InvalidAdmin,
    #[msg("Mint Amount Less than Token Creation Fee")]
    MintAmountLessThanTokenCreationFee,
}

impl From<DecoderError> for ContractError {
    fn from(_err: DecoderError) -> Self {
        ContractError::DecoderError
    }
}
