use anchor_lang::prelude::*;

#[error_code]
pub enum ProofOfHackError {
    #[msg("Protocol name must be between 1 and 64 characters")]
    InvalidProtocolName,

    #[msg("Severity must be between 1 (Low) and 4 (Critical)")]
    InvalidSeverity,

    #[msg("Grace period must be at least 60 seconds")]
    GracePeriodTooShort,

    #[msg("Encrypted proof exceeds maximum size of 1024 bytes")]
    EncryptedProofTooLarge,

    #[msg("Disclosure is not in the expected status for this action")]
    InvalidStatus,

    #[msg("Grace period has not elapsed yet")]
    GracePeriodNotElapsed,

    #[msg("Proof hash does not match the committed hash")]
    ProofHashMismatch,

    #[msg("Only the protocol authority can perform this action")]
    UnauthorizedProtocolAction,

    #[msg("Only the original hacker can perform this action")]
    UnauthorizedHackerAction,

    #[msg("Protocol does not match the disclosure's target program")]
    ProtocolMismatch,

    #[msg("Disclosure already claimed by a protocol")]
    AlreadyClaimed,

    #[msg("Plaintext proof exceeds maximum size of 1024 bytes")]
    PlaintextProofTooLarge,
}
