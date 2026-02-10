use anchor_lang::prelude::*;

declare_id!("4uYHTyZzVZjzJh4Dvh8R1hE779SxPbZj7ZMTTHAWTQAn");

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;

#[program]
pub mod proof_of_hack {
    use super::*;

    /// Register a protocol with its encryption public key.
    /// Signer must be the upgrade authority of the target program.
    pub fn register_protocol(
        ctx: Context<RegisterProtocol>,
        program_address: Pubkey,
        name: String,
        encryption_key: [u8; 32],
    ) -> Result<()> {
        instructions::register_protocol::handler(ctx, program_address, name, encryption_key)
    }

    /// Submit a vulnerability disclosure with proof hash and encrypted proof.
    pub fn submit_disclosure(
        ctx: Context<SubmitDisclosure>,
        proof_hash: [u8; 32],
        encrypted_proof: Vec<u8>,
        sender_encryption_key: [u8; 32],
        severity: u8,
        grace_period: i64,
        nonce: u64,
    ) -> Result<()> {
        instructions::submit_disclosure::handler(ctx, proof_hash, encrypted_proof, sender_encryption_key, severity, grace_period, nonce)
    }

    /// Protocol acknowledges receipt of the disclosure.
    pub fn acknowledge_disclosure(ctx: Context<AcknowledgeDisclosure>) -> Result<()> {
        instructions::acknowledge_disclosure::handler(ctx)
    }

    /// Protocol resolves the disclosure and records payment proof.
    /// WH-001: resolution_type makes the on-chain record honest about how it was resolved.
    pub fn resolve_disclosure(
        ctx: Context<ResolveDisclosure>,
        payment_hash: [u8; 32],
        resolution_type: u8,
    ) -> Result<()> {
        instructions::resolve_disclosure::handler(ctx, payment_hash, resolution_type)
    }

    /// Hacker reveals proof publicly after grace period.
    /// NOTE (WH-007): Reveal is allowed even after resolution. This is by design —
    /// the hacker always retains the right to publish. The protocol's incentive
    /// to pay fairly is reputational, not enforceable on-chain.
    pub fn reveal_proof(
        ctx: Context<RevealProof>,
        plaintext_proof: Vec<u8>,
    ) -> Result<()> {
        instructions::reveal_proof::handler(ctx, plaintext_proof)
    }

    /// Protocol claims an existing disclosure after registering.
    pub fn claim_disclosure(ctx: Context<ClaimDisclosure>) -> Result<()> {
        instructions::claim_disclosure::handler(ctx)
    }

    /// Create a bounty vault for a protocol with per-severity rates.
    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        low: u64,
        medium: u64,
        high: u64,
        critical: u64,
        deposit: u64,
    ) -> Result<()> {
        instructions::create_bounty::handler(ctx, low, medium, high, critical, deposit)
    }

    /// Fund an existing bounty vault with additional SOL.
    pub fn fund_bounty(ctx: Context<FundBounty>, amount: u64) -> Result<()> {
        instructions::fund_bounty::handler(ctx, amount)
    }

    /// Hacker claims bounty after disclosure is resolved.
    pub fn claim_bounty(ctx: Context<ClaimBounty>) -> Result<()> {
        instructions::claim_bounty_reward::handler(ctx)
    }

    /// Create protocol configuration (min grace period, etc.).
    /// WH-003: Split from set_protocol_config — explicit init, no init-if-needed.
    pub fn create_protocol_config(
        ctx: Context<CreateProtocolConfig>,
        min_grace_period: i64,
    ) -> Result<()> {
        instructions::create_protocol_config::handler(ctx, min_grace_period)
    }

    /// Update existing protocol configuration.
    /// WH-003: Split from set_protocol_config — update only, no init.
    pub fn update_protocol_config(
        ctx: Context<UpdateProtocolConfig>,
        min_grace_period: i64,
    ) -> Result<()> {
        instructions::update_protocol_config::handler(ctx, min_grace_period)
    }

    /// Deactivate a bounty vault. Only the protocol authority can call this.
    pub fn deactivate_bounty(ctx: Context<DeactivateBounty>) -> Result<()> {
        instructions::deactivate_bounty::handler(ctx)
    }

    /// Propose authority transfer to a new wallet (two-step: propose + accept).
    /// WH-011: Sets pending_authority; new authority must call accept_authority.
    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        instructions::transfer_authority::handler(ctx)
    }

    /// Accept a pending authority transfer. Must be signed by the pending new authority.
    /// WH-011: Finalizes the two-step transfer.
    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority::handler(ctx)
    }

    /// Withdraw SOL from a deactivated bounty vault.
    pub fn withdraw_bounty(ctx: Context<WithdrawBounty>, amount: u64) -> Result<()> {
        instructions::withdraw_bounty::handler(ctx, amount)
    }

    /// Update the protocol's encryption public key.
    /// WH-014: Allows key rotation without re-registering.
    pub fn update_encryption_key(
        ctx: Context<UpdateEncryptionKey>,
        new_key: [u8; 32],
    ) -> Result<()> {
        instructions::update_encryption_key::handler(ctx, new_key)
    }
}
