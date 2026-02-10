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

    #[msg("Grace period exceeds maximum of 1 year")]
    GracePeriodTooLong,

    #[msg("Grace period calculation overflow")]
    GracePeriodOverflow,

    #[msg("Bounty vault is not active")]
    VaultNotActive,

    #[msg("Insufficient funds in bounty vault")]
    InsufficientVaultFunds,

    #[msg("Bounty has already been claimed for this disclosure")]
    BountyAlreadyClaimed,

    #[msg("Disclosure has not been resolved yet")]
    DisclosureNotResolved,

    #[msg("Arithmetic overflow in bounty calculation")]
    BountyOverflow,

    #[msg("Only the protocol authority can manage the bounty vault")]
    UnauthorizedVaultAction,

    #[msg("Grace period is below the protocol's configured minimum")]
    GracePeriodBelowProtocolMinimum,

    #[msg("Minimum grace period must be between 0 and 1 year")]
    InvalidMinGracePeriod,

    #[msg("Signer is not the upgrade authority of the target program")]
    NotUpgradeAuthority,

    #[msg("Target program data account is invalid")]
    InvalidProgramData,

    #[msg("Protocol config PDA must be provided when targeting a registered protocol")]
    ProtocolConfigRequired,

    #[msg("Invalid protocol config PDA")]
    InvalidProtocolConfig,

    #[msg("Bounty vault is already inactive")]
    VaultAlreadyInactive,

    #[msg("New authority cannot be the zero address")]
    InvalidNewAuthority,

    #[msg("Invalid resolution type")]
    InvalidResolutionType,

    #[msg("Target must be a deployed, executable program")]
    InvalidTargetProgram,

    #[msg("Encrypted proof is too small to contain valid NaCl box ciphertext")]
    EncryptedProofTooSmall,

    #[msg("Bounty vault must be deactivated before withdrawal")]
    VaultStillActive,

    #[msg("No pending authority transfer to accept")]
    NoPendingTransfer,
}
