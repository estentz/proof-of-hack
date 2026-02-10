use anchor_lang::prelude::*;

/// Status of a disclosure
pub mod disclosure_status {
    pub const SUBMITTED: u8 = 0;
    pub const ACKNOWLEDGED: u8 = 1;
    pub const RESOLVED: u8 = 2;
    pub const REVEALED: u8 = 3;
}

/// How a disclosure was resolved
pub mod resolution_type {
    pub const NONE: u8 = 0;
    pub const OFFCHAIN_ATTESTATION: u8 = 1;
    pub const ONCHAIN_BOUNTY: u8 = 2;
    pub const NO_PAYMENT: u8 = 3;
}

/// Severity levels
pub mod severity {
    pub const LOW: u8 = 1;
    pub const MEDIUM: u8 = 2;
    pub const HIGH: u8 = 3;
    pub const CRITICAL: u8 = 4;
}

/// Protocol registration — teams register their programs
#[account]
pub struct Protocol {
    /// Who controls this protocol entry
    pub authority: Pubkey,
    /// The program being protected
    pub program_address: Pubkey,
    /// Protocol name (max 64 chars)
    pub name: String,
    /// X25519 public key for encrypted disclosures
    pub encryption_key: [u8; 32],
    /// When the protocol was registered
    pub registered_at: i64,
    /// Pending new authority for two-step transfer (Pubkey::default() = none)
    pub pending_authority: Pubkey,
    /// PDA bump
    pub bump: u8,
}

impl Protocol {
    /// 8 (discriminator) + 32 + 32 + (4 + 64) + 32 + 8 + 32 + 1 = 213
    pub const MAX_SIZE: usize = 8 + 32 + 32 + (4 + 64) + 32 + 8 + 32 + 1;
}

/// Vulnerability disclosure — the core record
#[account]
pub struct Disclosure {
    /// Who found the bug
    pub hacker: Pubkey,
    /// Protocol PDA (or Pubkey::default() if unregistered)
    pub protocol: Pubkey,
    /// The actual program with the vulnerability
    pub target_program: Pubkey,
    /// SHA-256 of plaintext proof (commitment)
    pub proof_hash: [u8; 32],
    /// NaCl box encrypted, max 1024 bytes
    pub encrypted_proof: Vec<u8>,
    /// Hacker's X25519 public key for NaCl box decryption
    pub sender_encryption_key: [u8; 32],
    /// 1=Low, 2=Medium, 3=High, 4=Critical
    pub severity: u8,
    /// 0=Submitted, 1=Acknowledged, 2=Resolved, 3=Revealed
    pub status: u8,
    /// How the disclosure was resolved (see resolution_type module)
    pub resolution_type: u8,
    /// Hash of bounty payment tx (set on resolve)
    pub payment_hash: [u8; 32],
    /// When the disclosure was submitted
    pub submitted_at: i64,
    /// When the disclosure was acknowledged
    pub acknowledged_at: i64,
    /// When the disclosure was resolved
    pub resolved_at: i64,
    /// Seconds before reveal is allowed (default 7 days, min 60s for demo)
    pub grace_period: i64,
    /// Unique per hacker+protocol pair
    pub nonce: u64,
    /// PDA bump
    pub bump: u8,
}

impl Disclosure {
    /// 8 + 32 + 32 + 32 + 32 + (4 + 1024) + 32 + 1 + 1 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 1 = 1272
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 32 + 32 + (4 + 1024) + 32 + 1 + 1 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

/// Bounty vault — holds SOL for automatic payouts per severity
#[account]
pub struct BountyVault {
    /// Linked protocol PDA
    pub protocol: Pubkey,
    /// Lamports paid for Low severity disclosures
    pub low_bounty: u64,
    /// Lamports paid for Medium severity disclosures
    pub medium_bounty: u64,
    /// Lamports paid for High severity disclosures
    pub high_bounty: u64,
    /// Lamports paid for Critical severity disclosures
    pub critical_bounty: u64,
    /// Total SOL deposited into vault
    pub total_deposited: u64,
    /// Total SOL paid out to hackers
    pub total_paid: u64,
    /// Whether this vault is accepting claims
    pub active: bool,
    /// When the vault was created
    pub created_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl BountyVault {
    /// 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1 = 98
    pub const MAX_SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1;
}

/// Receipt proving a bounty was claimed (prevents double-claim)
#[account]
pub struct BountyClaim {
    /// PDA bump
    pub bump: u8,
}

impl BountyClaim {
    /// 8 + 1 = 9
    pub const MAX_SIZE: usize = 8 + 1;
}

/// Protocol configuration — optional settings set by protocol authority.
/// Separate account to avoid breaking existing Protocol accounts.
/// PDA seeds: [b"protocol_config", protocol_pda]
#[account]
pub struct ProtocolConfig {
    /// The protocol PDA this config belongs to
    pub protocol: Pubkey,
    /// Minimum grace period in seconds that hackers must set.
    /// 0 = use global minimum (60 seconds).
    pub min_grace_period: i64,
    /// PDA bump
    pub bump: u8,
}

impl ProtocolConfig {
    /// 8 + 32 + 8 + 1 = 49
    pub const MAX_SIZE: usize = 8 + 32 + 8 + 1;
}
