use anchor_lang::prelude::*;
use crate::state::{Protocol, ProtocolConfig};
use crate::errors::ProofOfHackError;

pub const MAX_MIN_GRACE_PERIOD: i64 = 31_536_000; // 1 year

/// WH-003: Split from set_protocol_config — explicit init, no init-if-needed.
#[derive(Accounts)]
pub struct CreateProtocolConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::MAX_SIZE,
        seeds = [b"protocol_config", protocol.key().as_ref()],
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        has_one = authority @ ProofOfHackError::UnauthorizedProtocolAction,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateProtocolConfig>, min_grace_period: i64) -> Result<()> {
    require!(
        min_grace_period >= 0 && min_grace_period <= MAX_MIN_GRACE_PERIOD,
        ProofOfHackError::InvalidMinGracePeriod
    );

    let config = &mut ctx.accounts.config;
    config.protocol = ctx.accounts.protocol.key();
    config.min_grace_period = min_grace_period;
    config.bump = ctx.bumps.config;

    msg!("Protocol config created for {}", ctx.accounts.protocol.key());
    Ok(())
}
