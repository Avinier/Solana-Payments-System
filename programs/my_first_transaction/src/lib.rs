use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::clock::Clock;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Replace with your program ID

#[program]
pub mod peer_to_peer_payment {
    use super::*;

    pub fn send_payment(ctx: Context<SendPayment>, amount: u64, memo: String) -> Result<()> {
        // --- Input Validation & Security Checks ---
        // Check 1: Amount > 0
        if amount == 0 {
            return err!(ErrorCode::InvalidAmount);
        }
        // Check 2: Sender != Receiver
        if ctx.accounts.sender.key() == ctx.accounts.receiver.key() {
            return err!(ErrorCode::SelfPayment);
        }
        // Check 3: Memo Length
        if memo.chars().count() > MAX_MEMO_LENGTH {
             return err!(ErrorCode::MemoTooLong);
        }
        // Check 4: Sufficient Sender Balance
        if ctx.accounts.sender.lamports() < amount {
            return err!(ErrorCode::InsufficientBalance);
        }
        // Check 5: Receiver Account Ownership (Must be owned by System Program to receive SOL directly)
        if *ctx.accounts.receiver.owner != system_program::ID {
             return err!(ErrorCode::InvalidReceiver);
        }

        // Create the CPI context
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver.to_account_info(),
            },
        );

        // Execute the transfer
        system_program::transfer(cpi_context, amount)?;

        // Log the payment (optional, could store in an account later)
        msg!("Payment Sent: {} lamports from {} to {} with memo: {}",
             amount,
             ctx.accounts.sender.key(),
             ctx.accounts.receiver.key(),
             memo);

        // Record the transaction
        let transaction_record = &mut ctx.accounts.transaction_record;
        transaction_record.sender = ctx.accounts.sender.key();
        transaction_record.receiver = ctx.accounts.receiver.key();
        transaction_record.amount = amount;
        transaction_record.memo = memo.clone(); // Clone memo as it was moved in the msg! macro
        transaction_record.timestamp = Clock::get()?.unix_timestamp;

        // Increment total transaction count
        let program_state = &mut ctx.accounts.program_state;
        // Use checked_add for safety against overflow
        program_state.total_transactions = program_state.total_transactions.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!("Transaction recorded. Total transactions: {}", program_state.total_transactions);

        Ok(())
    }

    pub fn initialize_state(ctx: Context<InitializeState>) -> Result<()> {
        ctx.accounts.program_state.total_transactions = 0;
        msg!("Program state initialized. Total transactions: 0");
        Ok(())
    }

    // TODO: Add instruction to query payment history (will need different seeds/approach)
}

#[derive(Accounts)]
#[instruction(amount: u64, memo: String)] // amount/memo passed in args, not needed here unless constraining
pub struct SendPayment<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: Receiver account does not need to sign, but we need its public key.
    /// We are transferring SOL to this account, so it must be writable.
    #[account(mut)]
    pub receiver: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        init,
        payer = sender,
        space = TransactionRecord::LEN,
        // Seeds: "transaction", sender pubkey, current total_transactions count (as LE bytes)
        // This ensures a unique PDA for each transaction by this sender.
        seeds = [b"transaction", sender.key().as_ref(), program_state.total_transactions.to_le_bytes().as_ref()],
        bump
    )]
    pub transaction_record: Account<'info, TransactionRecord>,
    #[account(mut, seeds = [b"state"], bump)] // Assuming state PDA is seeded with just "state"
    pub program_state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
pub struct InitializeState<'info> {
    #[account(
        init,
        payer = user,
        space = ProgramState::LEN,
        seeds = [b"state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub user: Signer<'info>, // The user initializing the state
    pub system_program: Program<'info, System>,
}

// Account to store payment details (example structure)
#[account]
pub struct TransactionRecord {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub memo: String, // Store the memo
    // Add other relevant fields like transaction signature, sequence number etc.
}

// Define space for TransactionRecord - adjust based on actual fields
const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const U64_LENGTH: usize = 8;
const I64_LENGTH: usize = 8;
const STRING_LENGTH_PREFIX: usize = 4; // Stores the size of the string
const MAX_MEMO_LENGTH: usize = 200; // Max length of memo string in characters
const MAX_MEMO_BYTES: usize = MAX_MEMO_LENGTH * 4; // Max length in bytes (assuming worst-case 4 bytes per char)

impl TransactionRecord {
    pub const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH // sender
        + PUBLIC_KEY_LENGTH // receiver
        + U64_LENGTH // amount
        + I64_LENGTH // timestamp
        + STRING_LENGTH_PREFIX + MAX_MEMO_BYTES; // memo
}

// Account to store global program state
#[account]
pub struct ProgramState {
    pub total_transactions: u64,
}

impl ProgramState {
    // Define space for ProgramState
    // Discriminator (8) + total_transactions (u64 = 8)
    pub const LEN: usize = 8 + 8;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Memo cannot be longer than 200 characters.")]
    MemoTooLong,
    #[msg("Operation overflowed.")]
    Overflow,
    #[msg("Payment amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Sender and receiver cannot be the same account.")]
    SelfPayment,
    #[msg("Sender does not have sufficient balance for this transaction.")]
    InsufficientBalance,
    #[msg("Receiver account is not valid for receiving SOL (must be system-owned).")]
    InvalidReceiver,
    // Add other custom errors as needed
}
