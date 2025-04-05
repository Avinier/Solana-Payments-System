#[program]
pub mod my_solana_dapp {
    use super::*;
    pub fn create_greeting(ctx: Context<CreateGreeting>) -> Result<()> {
        let greeting_account = &mut ctx.accounts.greeting_account;
        greeting_account.counter = 0;
        Ok(())
    }

    pub fn increment_greeting(ctx: Context<IncrementGreeting>) -> Result<()> {
        let greeting_account = &mut ctx.accounts.greeting_account;
        greeting_account.counter += 1;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateGreeting<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub greeting_account: Account<'info, GreetingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IncrementGreeting<'info> {
    #[account(mut)]
    pub greeting_account: Account<'info, GreetingAccount>,
}

#[account]
pub struct GreetingAccount {
    pub counter: u64,
}
