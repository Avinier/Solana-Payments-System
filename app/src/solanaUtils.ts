import { Connection, PublicKey, clusterApiUrl, Cluster, SystemProgram, TransactionSignature, GetProgramAccountsFilter } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react'; // Assuming usage of @solana/wallet-adapter-react
import { PeerToPeerPayment } from '../../target/types/peer_to_peer_payment'; // Import type directly
import idlJson from '../../target/idl/peer_to_peer_payment.json'; // Corrected IDL import path

// Constants
export const PROGRAM_ID = new PublicKey('9bEZzU79kVvmUMuYdLze5pDvswKTDmLjGws6LCdeZBG2');
export const SOLANA_NETWORK = 'localnet'; // Match Anchor.toml (Removed : Cluster type)

/**
 * Establishes a connection to the Solana cluster.
 * @param network - The Solana network cluster (e.g., 'localnet', 'devnet', 'mainnet-beta').
 * @returns A Connection object.
 */
export const getConnection = (network: Cluster | 'localnet' = SOLANA_NETWORK): Connection => {
    const endpoint = network === 'localnet'
        ? 'http://127.0.0.1:8899' // Default localnet RPC
        : clusterApiUrl(network); // network must be 'devnet', 'testnet', or 'mainnet-beta' here
    return new Connection(endpoint, 'confirmed');
};

/**
 * Creates an AnchorProvider.
 * @param connection - The Solana connection object.
 * @param wallet - The wallet object from a wallet adapter (e.g., useWallet()).
 * @returns An AnchorProvider instance.
 * @throws Error if the wallet is not connected.
 */
export const getProvider = (connection: Connection, wallet: WalletContextState): AnchorProvider => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
        throw new Error("Wallet not connected or doesn't support signing");
    }

    // The AnchorProvider needs a wallet object that adheres to its expected interface.
    // We adapt the WalletContextState from @solana/wallet-adapter-react.
    const providerWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
    };

    const provider = new AnchorProvider(
        connection,
        providerWallet,
        AnchorProvider.defaultOptions()
    );
    return provider;
};

/**
 * Loads the Anchor program instance.
 * @param provider - The AnchorProvider instance.
 * @param programId - The PublicKey of the program.
 * @returns The Program instance.
 */
export const getProgram = (provider: AnchorProvider, programId: PublicKey = PROGRAM_ID): Program<PeerToPeerPayment> => {
    // Explicitly cast the imported JSON to Idl type
    const idl: Idl = idlJson as Idl;
    // Use the documented constructor order: (idl, programId, provider)
    // Trying (idl, programId, provider) order with 'as any' workaround
    return new Program(idl, programId, provider) as any as Program<PeerToPeerPayment>;
};


/**
 * Sends a payment transaction using the Anchor program.
 * @param program - The initialized Anchor program instance.
 * @param sender - The sender's PublicKey.
 * @param receiver - The receiver's PublicKey.
 * @param amountLamports - The amount to send in lamports (as a BN).
 * @param memo - A string memo for the transaction.
 * @returns The transaction signature.
 * @throws Error if the program state is not initialized or other issues occur.
 */
export const sendPaymentTransaction = async (
    program: Program<PeerToPeerPayment>,
    sender: PublicKey,
    receiver: PublicKey,
    amountLamports: BN,
    memo: string
): Promise<TransactionSignature> => {

    // 1. Derive the program state PDA
    const [programStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        program.programId
    );

    // 2. Fetch the current transaction count from the program state
    let currentTotalTransactions: BN;
    try {
        const stateAccount = await program.account.programState.fetch(programStatePDA);
        currentTotalTransactions = stateAccount.totalTransactions;
    } catch (error) {
        console.error("Failed to fetch program state:", error);
        // Handle case where state might not be initialized
        // You might want to prompt the user to initialize it or handle differently
        throw new Error("Program state not found or initialized. Please initialize the program state first.");
    }

    // 3. Derive the transaction record PDA using the fetched count
    const [transactionRecordPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("transaction"),
            sender.toBuffer(),
            currentTotalTransactions.toArrayLike(Buffer, "le", 8) // u64 as 8-byte Little Endian buffer
        ],
        program.programId
    );

    // 4. Call the send_payment instruction
    try {
        const txSignature = await program.methods
            .sendPayment(amountLamports, memo)
            .accounts({
                sender: sender,
                receiver: receiver,
                systemProgram: SystemProgram.programId,
                transactionRecord: transactionRecordPDA,
                programState: programStatePDA,
            } as any) // Temporary cast to 'any' to bypass TS check
            // Note: No explicit signer needed here if using an AnchorProvider
            // with a connected wallet, as the provider handles signing.
            .rpc();

        console.log("Payment successful! Transaction signature:", txSignature);
        return txSignature;
    } catch (error) {
        console.error("Error sending payment:", error);
        // TODO: Provide more user-friendly error messages based on program errors (ErrorCode)
        throw error; // Re-throw the error for handling in the UI
    }
};

// Define the structure matching the Rust TransactionRecord account for type safety
// Note: BN is used for u64/i64 types
export interface TransactionRecordAccount {
    sender: PublicKey;
    receiver: PublicKey;
    amount: BN;
    timestamp: BN;
    memo: string;
}

// Calculated size based on Rust struct: 8 + 32 + 32 + 8 + 8 + 4 + (200 * 4) = 892
const TRANSACTION_RECORD_ACCOUNT_SIZE = 892;

/**
 * Fetches the transaction history for a given sender.
 * @param connection - The Solana Connection object.
 * @param program - The initialized Anchor program instance (used for decoding).
 * @param senderPublicKey - The PublicKey of the sender whose history to fetch.
 * @returns A promise that resolves to an array of TransactionRecordAccount objects, sorted by timestamp descending.
 */
export const getTransactionHistory = async (
    connection: Connection,
    program: Program<PeerToPeerPayment>, // Use correct type name
    senderPublicKey: PublicKey
): Promise<TransactionRecordAccount[]> => {
    const filters: GetProgramAccountsFilter[] = [
        // 1. Filter by account size
        {
            dataSize: TRANSACTION_RECORD_ACCOUNT_SIZE,
        },
        // 2. Filter by the sender public key (starts at offset 8)
        {
            memcmp: {
                offset: 8, // Discriminator is 8 bytes
                bytes: senderPublicKey.toBase58(),
            },
        },
    ];

    try {
        const accounts = await connection.getProgramAccounts(program.programId, {
            encoding: 'base64', // Fetch raw data to decode with Anchor
            filters: filters,
        });

        console.log(`Found ${accounts.length} potential transaction records for sender ${senderPublicKey.toBase58()}.`);

        const transactions: TransactionRecordAccount[] = accounts
            .map(accountInfo => {
                try {
                    // Decode the account data using the program's coder
                    const decoded = program.coder.accounts.decode<TransactionRecordAccount>(
                        "TransactionRecord", // Name of the account struct in Rust
                        accountInfo.account.data as Buffer
                    );
                    return decoded;
                } catch (decodeError) {
                    console.error(`Failed to decode account ${accountInfo.pubkey.toBase58()}:`, decodeError);
                    return null; // Skip accounts that fail to decode
                }
            })
            .filter((tx): tx is TransactionRecordAccount => tx !== null) // Filter out nulls from failed decodes
            .sort((a, b) => b.timestamp.cmp(a.timestamp)); // Sort by timestamp descending (most recent first)

        return transactions;

    } catch (error) {
        console.error("Error fetching transaction history:", error);
        throw new Error("Failed to fetch transaction history.");
    }
};

// Removed duplicated code block