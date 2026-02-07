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
    /// Anyone can register; the signer becomes the authority.
    pub fn register_protocol(
        ctx: Context<RegisterProtocol>,
        program_address: Pubkey,
        name: String,
        encryption_key: [u8; 32],
    ) -> Result<()> {
        instructions::register_protocol::handler(ctx, program_address, name, encryption_key)
    }

    /// Submit a vulnerability disclosure with proof hash and optional encrypted proof.
    pub fn submit_disclosure(
        ctx: Context<SubmitDisclosure>,
        proof_hash: [u8; 32],
        encrypted_proof: Vec<u8>,
        severity: u8,
        grace_period: i64,
        nonce: u64,
    ) -> Result<()> {
        instructions::submit_disclosure::handler(ctx, proof_hash, encrypted_proof, severity, grace_period, nonce)
    }

    /// Protocol acknowledges receipt of the disclosure.
    pub fn acknowledge_disclosure(ctx: Context<AcknowledgeDisclosure>) -> Result<()> {
        instructions::acknowledge_disclosure::handler(ctx)
    }

    /// Protocol resolves the disclosure and records payment proof.
    pub fn resolve_disclosure(
        ctx: Context<ResolveDisclosure>,
        payment_hash: [u8; 32],
    ) -> Result<()> {
        instructions::resolve_disclosure::handler(ctx, payment_hash)
    }

    /// Hacker reveals proof publicly after grace period (nuclear option).
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
}
