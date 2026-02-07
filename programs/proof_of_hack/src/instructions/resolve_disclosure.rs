use anchor_lang::prelude::*;
use crate::state::{Protocol, Disclosure, disclosure_status};
use crate::errors::ProofOfHackError;

#[derive(Accounts)]
pub struct ResolveDisclosure<'info> {
    #[account(
        mut,
        constraint = disclosure.protocol == protocol.key() @ ProofOfHackError::ProtocolMismatch,
        constraint = disclosure.status == disclosure_status::ACKNOWLEDGED @ ProofOfHackError::InvalidStatus,
    )]
    pub disclosure: Account<'info, Disclosure>,

    #[account(
        constraint = protocol.authority == authority.key() @ ProofOfHackError::UnauthorizedProtocolAction,
    )]
    pub protocol: Account<'info, Protocol>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<ResolveDisclosure>, payment_hash: [u8; 32]) -> Result<()> {
    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.status = disclosure_status::RESOLVED;
    disclosure.payment_hash = payment_hash;
    disclosure.resolved_at = Clock::get()?.unix_timestamp;

    msg!(
        "Disclosure {} resolved with payment proof",
        disclosure.key()
    );
    Ok(())
}
