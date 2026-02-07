use anchor_lang::prelude::*;
use sha2::{Sha256, Digest};
use crate::state::{Disclosure, disclosure_status};
use crate::errors::ProofOfHackError;

pub const MAX_PLAINTEXT_PROOF: usize = 1024;

#[derive(Accounts)]
pub struct RevealProof<'info> {
    #[account(
        mut,
        constraint = disclosure.hacker == hacker.key() @ ProofOfHackError::UnauthorizedHackerAction,
        constraint = disclosure.status == disclosure_status::SUBMITTED @ ProofOfHackError::InvalidStatus,
    )]
    pub disclosure: Account<'info, Disclosure>,

    pub hacker: Signer<'info>,
}

pub fn handler(ctx: Context<RevealProof>, plaintext_proof: Vec<u8>) -> Result<()> {
    let disclosure = &mut ctx.accounts.disclosure;

    require!(
        plaintext_proof.len() <= MAX_PLAINTEXT_PROOF,
        ProofOfHackError::PlaintextProofTooLarge
    );

    // Check grace period has elapsed
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= disclosure.submitted_at + disclosure.grace_period,
        ProofOfHackError::GracePeriodNotElapsed
    );

    // Verify proof hash matches commitment (SHA-256)
    let mut hasher = Sha256::new();
    hasher.update(&plaintext_proof);
    let computed_hash: [u8; 32] = hasher.finalize().into();
    require!(
        computed_hash == disclosure.proof_hash,
        ProofOfHackError::ProofHashMismatch
    );

    // Store plaintext proof in the encrypted_proof field (repurposed after reveal)
    disclosure.encrypted_proof = plaintext_proof;
    disclosure.status = disclosure_status::REVEALED;

    msg!(
        "Disclosure {} proof revealed by hacker {}",
        disclosure.key(),
        disclosure.hacker
    );
    Ok(())
}
