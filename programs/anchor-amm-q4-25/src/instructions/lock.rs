use anchor_lang::prelude::*;

use crate::{errors::AmmError, state::Config};

#[derive(Accounts)]
pub struct Lock<'info> {
    #[account(
        constraint = config.authority.is_some() @ AmmError::NoAuthoritySet,
        constraint = authority.key() == config.authority.unwrap() @ AmmError::InvalidAuthority
    )]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config", config.seed.to_le_bytes().as_ref()],
        bump = config.config_bump,
    )]
    pub config: Account<'info, Config>,
}

impl<'info> Lock<'info> {
    pub fn lock(&mut self, locked: bool) -> Result<()> {
        self.config.locked = locked;
        Ok(())
    }
}
