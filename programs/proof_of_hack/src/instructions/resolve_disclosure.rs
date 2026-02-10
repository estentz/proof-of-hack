use anchor_lang::prelude::*;
use crate::state::{Protocol, Disclosure, disclosure_status, resolution_type};
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

pub fn handler(ctx: Context<ResolveDisclosure>, payment_hash: [u8; 32], res_type: u8) -> Result<()> {
    // WH-001: Validate resolution type so on-chain record is honest
    require!(
        res_type >= resolution_type::OFFCHAIN_ATTESTATION && res_type <= resolution_type::NO_PAYMENT,
        ProofOfHackError::InvalidResolutionType
    );

    let disclosure = &mut ctx.accounts.disclosure;
    disclosure.status = disclosure_status::RESOLVED;
    disclosure.payment_hash = payment_hash;
    disclosure.resolution_type = res_type;
    disclosure.resolved_at = Clock::get()?.unix_timestamp;

    msg!(
        "Disclosure {} resolved (type: {})",
        disclosure.key(),
        res_type
    );
    Ok(())
}
