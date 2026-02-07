use anchor_lang::prelude::*;

/// Status of a disclosure
pub mod disclosure_status {
    pub const SUBMITTED: u8 = 0;
    pub const ACKNOWLEDGED: u8 = 1;
    pub const RESOLVED: u8 = 2;
    pub const REVEALED: u8 = 3;
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
    /// PDA bump
    pub bump: u8,
}

impl Protocol {
    /// 8 (discriminator) + 32 + 32 + (4 + 64) + 32 + 8 + 1 = 181
    pub const MAX_SIZE: usize = 8 + 32 + 32 + (4 + 64) + 32 + 8 + 1;
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
    /// 1=Low, 2=Medium, 3=High, 4=Critical
    pub severity: u8,
    /// 0=Submitted, 1=Acknowledged, 2=Resolved, 3=Revealed
    pub status: u8,
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
    /// 8 + 32 + 32 + 32 + 32 + (4 + 1024) + 1 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 1 = 1239
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 32 + 32 + (4 + 1024) + 1 + 1 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}
