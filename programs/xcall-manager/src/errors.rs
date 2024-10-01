use anchor_lang::prelude::*;
use rlp::DecoderError;

#[error_code]
pub enum XCallManagerError {
    #[msg("Execution failed")]
    ExecutionFailed,
    #[msg("Unauthorized caller")]
    UnauthorizedCaller,
    #[msg("Protocol mismatch")]
    ProtocolMismatch,
    #[msg("Action not whitelisted")]
    ActionNotWhitelisted,
    #[msg("Unknown message type")]
    UnknownMessageType,
    #[msg("Invalid instruction")]
    InvalidInstruction,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Decoder Error")]
    DecoderError,
    #[msg("No proposal for removal exists")]
    NoProposalForRemovalExists,
    #[msg["Invalid Sender"]]
    InvalidSender,
    #[msg["Not the Icon Governance"]]
    NotTheIconGovernance,
    #[msg["Only Xcall"]]
    OnlyXcall,
    #[msg["Invalid Program"]]
    InvalidProgram,
}

impl From<DecoderError> for XCallManagerError {
    fn from(_err: DecoderError) -> Self {
        XCallManagerError::DecoderError
    }
}
