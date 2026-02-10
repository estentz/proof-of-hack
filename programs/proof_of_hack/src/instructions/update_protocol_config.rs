use anchor_lang::prelude::*;
use crate::state::{Protocol, ProtocolConfig};
use crate::errors::ProofOfHackError;

pub const MAX_MIN_GRACE_PERIOD: i64 = 31_536_000; // 1 year

/// WH-003: Split from set_protocol_config — update existing config.
#[derive(Accounts)]
pub struct UpdateProtocolConfig<'info> {
    #[account(
        mut,
        seeds = [b"protocol_config", protocol.key().as_ref()],
        bump = config.bump,
        has_one = protocol,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        has_one = authority @ ProofOfHackError::UnauthorizedProtocolAction,
    )]
    pub protocol: Account<'info, Protocol>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<UpdateProtocolConfig>, min_grace_period: i64) -> Result<()> {
    require!(
        min_grace_period >= 0 && min_grace_period <= MAX_MIN_GRACE_PERIOD,
        ProofOfHackError::InvalidMinGracePeriod
    );

    let config = &mut ctx.accounts.config;
    config.min_grace_period = min_grace_period;

    msg!("Protocol config updated for {}", ctx.accounts.protocol.key());
    Ok(())
}
