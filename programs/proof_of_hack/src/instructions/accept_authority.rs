use anchor_lang::prelude::*;
use crate::state::Protocol;
use crate::errors::ProofOfHackError;

/// WH-011: Two-step authority transfer — this is the accept step.
/// The proposed new authority signs to finalize the transfer.
#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(mut)]
    pub protocol: Account<'info, Protocol>,

    pub new_authority: Signer<'info>,
}

pub fn handler(ctx: Context<AcceptAuthority>) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;
    require!(
        protocol.pending_authority == ctx.accounts.new_authority.key(),
        ProofOfHackError::UnauthorizedProtocolAction
    );
    require!(
        protocol.pending_authority != Pubkey::default(),
        ProofOfHackError::NoPendingTransfer
    );

    let old = protocol.authority;
    protocol.authority = protocol.pending_authority;
    protocol.pending_authority = Pubkey::default();

    msg!(
        "Authority transfer accepted for protocol {}: {} -> {}",
        protocol.program_address,
        old,
        protocol.authority
    );
    Ok(())
}
