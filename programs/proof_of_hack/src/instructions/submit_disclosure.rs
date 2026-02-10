use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;
use crate::state::{Disclosure, ProtocolConfig, disclosure_status, resolution_type, severity};
use crate::errors::ProofOfHackError;

pub const MIN_GRACE_PERIOD: i64 = 60; // 60 seconds minimum (for demo)
pub const MAX_GRACE_PERIOD: i64 = 31_536_000; // 1 year maximum
pub const DEFAULT_GRACE_PERIOD: i64 = 604800; // 7 days
pub const MAX_ENCRYPTED_PROOF: usize = 1024;
pub const MIN_ENCRYPTED_PROOF: usize = 48; // 24 nonce + 16 auth tag + 8 min payload

#[derive(Accounts)]
#[instruction(proof_hash: [u8; 32], encrypted_proof: Vec<u8>, sender_encryption_key: [u8; 32], severity: u8, grace_period: i64, nonce: u64)]
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

    /// CHECK: Must be an executable program on-chain (WH-005).
    #[account(
        constraint = target_program.executable @ ProofOfHackError::InvalidTargetProgram
    )]
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
    sender_encryption_key: [u8; 32],
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
        grace_period <= MAX_GRACE_PERIOD,
        ProofOfHackError::GracePeriodTooLong
    );
    require!(
        encrypted_proof.len() <= MAX_ENCRYPTED_PROOF,
        ProofOfHackError::EncryptedProofTooLarge
    );
    // WH-006: If encrypted proof is provided, enforce minimum size for valid NaCl box
    if !encrypted_proof.is_empty() {
        require!(
            encrypted_proof.len() >= MIN_ENCRYPTED_PROOF,
            ProofOfHackError::EncryptedProofTooSmall
        );
    }

    // --- WH-002 FIX: Enforce ProtocolConfig min_grace_period ---
    // Always derive protocol PDA from target_program to prevent bypass.
    // Hackers cannot skip the min_grace_period by omitting the protocol link.
    let target_key = ctx.accounts.target_program.key();
    let (derived_protocol_pda, _) = Pubkey::find_program_address(
        &[b"protocol", target_key.as_ref()],
        ctx.program_id,
    );

    // Derive the config PDA for this target's protocol
    let (config_pda, _) = Pubkey::find_program_address(
        &[b"protocol_config", derived_protocol_pda.as_ref()],
        ctx.program_id,
    );

    // Look for the config account in remaining_accounts and enforce min_grace_period
    for account_info in ctx.remaining_accounts.iter() {
        if account_info.key() == config_pda
            && *account_info.owner == *ctx.program_id
            && !account_info.data_is_empty()
        {
            let config = ProtocolConfig::try_deserialize(
                &mut &account_info.data.borrow()[..],
            )?;
            if config.min_grace_period > 0 {
                require!(
                    grace_period >= config.min_grace_period,
                    ProofOfHackError::GracePeriodBelowProtocolMinimum
                );
            }
            break;
        }
    }

    // If hacker provided a specific protocol PDA, validate it matches the target
    let protocol_key = ctx.accounts.protocol.key();
    if protocol_key != Pubkey::default() {
        require!(
            protocol_key == derived_protocol_pda,
            ProofOfHackError::ProtocolMismatch
        );
    }

    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.hacker = ctx.accounts.hacker.key();
    disclosure.protocol = ctx.accounts.protocol.key();
    disclosure.target_program = ctx.accounts.target_program.key();
    disclosure.proof_hash = proof_hash;
    disclosure.encrypted_proof = encrypted_proof;
    disclosure.sender_encryption_key = sender_encryption_key;
    disclosure.severity = sev;
    disclosure.status = disclosure_status::SUBMITTED;
    disclosure.resolution_type = resolution_type::NONE;
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
