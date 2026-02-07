use anchor_lang::prelude::*;
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

    let protocol = &mut ctx.accounts.protocol;
    protocol.authority = ctx.accounts.authority.key();
    protocol.program_address = program_address;
    protocol.name = name;
    protocol.encryption_key = encryption_key;
    protocol.registered_at = Clock::get()?.unix_timestamp;
    protocol.bump = ctx.bumps.protocol;

    msg!("Protocol registered: {}", protocol.program_address);
    Ok(())
}
