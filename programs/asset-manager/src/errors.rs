use anchor_lang::prelude::*;
use rlp::DecoderError;

#[error_code]
pub enum AssetManagerError {
    #[msg("Amount less than minimum amount")]
    AmountLessThanMinimum,
    #[msg("Exceeds withdraw limit")]
    ExceedsWithdrawLimit,
    #[msg("Failed to send tokens")]
    TokenTransferFailed,
    #[msg("Percentage should be less than or equal to 10000")]
    PercentageTooHigh,
    #[msg("Unauthorized caller")]
    UnauthorizedCaller,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Unknown Method")]
    UnknownMethod,
    #[msg("Method Decode Error")]
    DecoderError,
    #[msg("Invalid Instruction")]
    InvalidInstruction,
    #[msg["Token not configured"]]
    TokenNotConfigured,
    #[msg["Xcall manager required"]]
    XcallManagerRequired,
    #[msg["Not the icon asset manager"]]
    NotIconAssetManager,
    #[msg["Protocol Mismatch"]]
    ProtocolMismatch,
    #[msg["Unknown Message"]]
    UnknownMessage,
    #[msg["Insufficient Balance"]]
    InsufficientBalance,
    #[msg["Not the asset manager key"]]
    NotAssetManager,
    #[msg["test error"]]
    TestError,
    #[msg["invalid to address"]]
    InvalidToAddress,
    #[msg["invalid from address"]]
    InvalidFromAddress,
    #[msg["Mint is required"]]
    MintIsRequired,
    #[msg["Token program is required"]]
    TokenProgramIsRequired,
    #[msg["Vault Token Program is required"]]
    ValultTokenAccountIsRequired,
    #[msg["Vault authority is required"]]
    ValultAuthorityIsRequired,
    #[msg["Not an address"]]
    NotAnAddress,
    #[msg["Only Xcall"]]
    OnlyXcall,
    #[msg["Invalid Program"]]
    InvalidProgram,
    #[msg["Invalid Xcall Manager State"]]
    InvalidXcallManagerState,
    #[msg["Invalid Vault Token Account"]]
    InvalidValultTokenAccount,
    #[msg["Invalid Vault Authority"]]
    InvalidValutAuthority,
    #[msg["Invalid Vault Native Authority"]]
    InvalidValutNativeAuthority
}

impl From<DecoderError> for AssetManagerError {
    fn from(_err: DecoderError) -> Self {
        AssetManagerError::DecoderError
    }
}
