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
    #[msg("NotBalancedDollar")]
    NotBalancedDollar
}

impl From<DecoderError> for BalancedDollarError {
    fn from(_err: DecoderError) -> Self {
        BalancedDollarError::DecoderError
    }
}