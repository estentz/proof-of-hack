use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;
use crate::state::Protocol;
use crate::errors::ProofOfHackError;

#[derive(Accounts)]
#[instruction(program_address: Pubkey)]
pub struct RegisterProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = Protocol::MAX_SIZE,
        seeds = [b"protocol", program_address.as_ref()],
        bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The target program's programdata account from the BPF Upgradeable Loader.
    /// Verified in the handler: address derivation, ownership, and upgrade authority match.
    pub program_data: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterProtocol>,
    program_address: Pubkey,
    name: String,
    encryption_key: [u8; 32],
) -> Result<()> {
    require!(
        !name.is_empty() && name.len() <= 64,
        ProofOfHackError::InvalidProtocolName
    );
    // Only allow printable ASCII to prevent homoglyph impersonation
    require!(
        name.bytes().all(|b| b >= 0x20 && b <= 0x7E),
        ProofOfHackError::InvalidProtocolName
    );

    // --- OWNERSHIP VERIFICATION (fixes protocol squatting) ---
    // Verify the signer is the upgrade authority of the target program.
    let program_data_info = &ctx.accounts.program_data;

    // Derive expected programdata PDA from BPF Upgradeable Loader
    let (expected_program_data, _) = Pubkey::find_program_address(
        &[program_address.as_ref()],
        &bpf_loader_upgradeable::id(),
    );
    require!(
        program_data_info.key() == expected_program_data,
        ProofOfHackError::InvalidProgramData
    );

    // Verify the account is owned by the BPF Upgradeable Loader
    require!(
        *program_data_info.owner == bpf_loader_upgradeable::id(),
        ProofOfHackError::InvalidProgramData
    );

    // Parse upgrade authority from programdata account
    // Layout: [4 bytes type][8 bytes slot][1 byte option tag][32 bytes authority]
    let data = program_data_info.try_borrow_data()?;
    require!(data.len() >= 45, ProofOfHackError::InvalidProgramData);

    // Verify it's a ProgramData account (type discriminant = 3)
    let account_type = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
    require!(account_type == 3, ProofOfHackError::InvalidProgramData);

    // Check that upgrade authority is present (program is not immutable)
    require!(data[12] == 1, ProofOfHackError::NotUpgradeAuthority);

    // Extract and verify the upgrade authority matches the signer
    let mut authority_bytes = [0u8; 32];
    authority_bytes.copy_from_slice(&data[13..45]);
    let upgrade_authority = Pubkey::new_from_array(authority_bytes);
    require!(
        upgrade_authority == ctx.accounts.authority.key(),
        ProofOfHackError::NotUpgradeAuthority
    );

    let protocol = &mut ctx.accounts.protocol;
    protocol.authority = ctx.accounts.authority.key();
    protocol.program_address = program_address;
    protocol.name = name;
    protocol.encryption_key = encryption_key;
    protocol.registered_at = Clock::get()?.unix_timestamp;
    protocol.pending_authority = Pubkey::default();
    protocol.bump = ctx.bumps.protocol;

    msg!("Protocol registered: {}", protocol.program_address);
    Ok(())
}
