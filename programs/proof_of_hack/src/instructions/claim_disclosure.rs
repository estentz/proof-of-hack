use anchor_lang::prelude::*;
use crate::state::{Protocol, Disclosure, disclosure_status};
use crate::errors::ProofOfHackError;

#[derive(Accounts)]
pub struct ClaimDisclosure<'info> {
    #[account(
        mut,
        constraint = disclosure.target_program == protocol.program_address @ ProofOfHackError::ProtocolMismatch,
        constraint = disclosure.protocol == Pubkey::default() @ ProofOfHackError::AlreadyClaimed,
        constraint = disclosure.status == disclosure_status::SUBMITTED @ ProofOfHackError::InvalidStatus,
    )]
    pub disclosure: Account<'info, Disclosure>,

    #[account(
        constraint = protocol.authority == authority.key() @ ProofOfHackError::UnauthorizedProtocolAction,
    )]
    pub protocol: Account<'info, Protocol>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<ClaimDisclosure>) -> Result<()> {
    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.protocol = ctx.accounts.protocol.key();

    msg!(
        "Disclosure {} claimed by protocol {}",
        disclosure.key(),
        ctx.accounts.protocol.key()
    );
    Ok(())
}
