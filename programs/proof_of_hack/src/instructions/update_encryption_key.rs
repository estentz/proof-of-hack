use anchor_lang::prelude::*;
use crate::state::Protocol;

/// WH-014: Encryption key rotation — allows protocol authority to update
/// the X25519 public key used for encrypting new disclosures.
#[derive(Accounts)]
pub struct UpdateEncryptionKey<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub protocol: Account<'info, Protocol>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateEncryptionKey>, new_key: [u8; 32]) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;
    protocol.encryption_key = new_key;

    msg!("Encryption key updated for protocol {}", protocol.program_address);
    Ok(())
}
