use anchor_lang::prelude::*;
use crate::state::{Protocol, Disclosure, disclosure_status};
use crate::errors::ProofOfHackError;

#[derive(Accounts)]
pub struct AcknowledgeDisclosure<'info> {
    #[account(
        mut,
        constraint = disclosure.protocol == protocol.key() @ ProofOfHackError::ProtocolMismatch,
        constraint = disclosure.status == disclosure_status::SUBMITTED @ ProofOfHackError::InvalidStatus,
    )]
    pub disclosure: Account<'info, Disclosure>,

    #[account(
        constraint = protocol.authority == authority.key() @ ProofOfHackError::UnauthorizedProtocolAction,
    )]
    pub protocol: Account<'info, Protocol>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<AcknowledgeDisclosure>) -> Result<()> {
    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.status = disclosure_status::ACKNOWLEDGED;
    disclosure.acknowledged_at = Clock::get()?.unix_timestamp;

    msg!(
        "Disclosure {} acknowledged by protocol {}",
        disclosure.key(),
        ctx.accounts.protocol.key()
    );
    Ok(())
}
