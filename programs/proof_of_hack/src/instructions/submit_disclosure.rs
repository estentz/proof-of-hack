use anchor_lang::prelude::*;
use crate::state::{Disclosure, disclosure_status, severity};
use crate::errors::ProofOfHackError;

pub const MIN_GRACE_PERIOD: i64 = 60; // 60 seconds minimum (for demo)
pub const DEFAULT_GRACE_PERIOD: i64 = 604800; // 7 days
pub const MAX_ENCRYPTED_PROOF: usize = 1024;

#[derive(Accounts)]
#[instruction(proof_hash: [u8; 32], encrypted_proof: Vec<u8>, severity: u8, grace_period: i64, nonce: u64)]
pub struct SubmitDisclosure<'info> {
    #[account(
        init,
        payer = hacker,
        space = Disclosure::MAX_SIZE,
        seeds = [
            b"disclosure",
            hacker.key().as_ref(),
            target_program.key().as_ref(),
            nonce.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub disclosure: Account<'info, Disclosure>,

    #[account(mut)]
    pub hacker: Signer<'info>,

    /// CHECK: This is the target program address, not an account we read from.
    /// It's used only as a PDA seed and stored as a reference.
    pub target_program: UncheckedAccount<'info>,

    /// CHECK: Optional protocol PDA. If provided and valid, links the disclosure.
    /// If Pubkey::default(), disclosure targets an unregistered protocol.
    pub protocol: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitDisclosure>,
    proof_hash: [u8; 32],
    encrypted_proof: Vec<u8>,
    sev: u8,
    grace_period: i64,
    nonce: u64,
) -> Result<()> {
    require!(
        sev >= severity::LOW && sev <= severity::CRITICAL,
        ProofOfHackError::InvalidSeverity
    );
    require!(
        grace_period >= MIN_GRACE_PERIOD,
        ProofOfHackError::GracePeriodTooShort
    );
    require!(
        encrypted_proof.len() <= MAX_ENCRYPTED_PROOF,
        ProofOfHackError::EncryptedProofTooLarge
    );

    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.hacker = ctx.accounts.hacker.key();
    disclosure.protocol = ctx.accounts.protocol.key();
    disclosure.target_program = ctx.accounts.target_program.key();
    disclosure.proof_hash = proof_hash;
    disclosure.encrypted_proof = encrypted_proof;
    disclosure.severity = sev;
    disclosure.status = disclosure_status::SUBMITTED;
    disclosure.payment_hash = [0u8; 32];
    disclosure.submitted_at = Clock::get()?.unix_timestamp;
    disclosure.acknowledged_at = 0;
    disclosure.resolved_at = 0;
    disclosure.grace_period = grace_period;
    disclosure.nonce = nonce;
    disclosure.bump = ctx.bumps.disclosure;

    msg!(
        "Disclosure submitted by {} targeting {} (severity: {})",
        disclosure.hacker,
        disclosure.target_program,
        disclosure.severity
    );
    Ok(())
}
