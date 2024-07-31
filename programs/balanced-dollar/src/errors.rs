use anchor_lang::prelude::*;
use rlp::DecoderError;

#[error_code]
pub enum BalancedDollarError {
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
    #[msg("Not Balanced Dollar")]
    NotBalancedDollar,
    #[msg("Not the xcall program")]
    NotXcall,
    #[msg("Insufficient Balance")]
    InsufficientBalance
}

impl From<DecoderError> for BalancedDollarError {
    fn from(_err: DecoderError) -> Self {
        BalancedDollarError::DecoderError
    }
}