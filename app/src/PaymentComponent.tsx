import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
    getConnection,
    getProvider,
    getProgram,
    sendPaymentTransaction,
    getTransactionHistory,
    TransactionRecordAccount, // Assuming this type is exported or defined
    PeerToPeerPayment, // Use the correct exported type name
    SOLANA_NETWORK,
    PROGRAM_ID
} from './solanaUtils';
import { Program } from '@coral-xyz/anchor';

// Basic styling (consider using a CSS file or library)
const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '20px', fontFamily: 'Arial, sans-serif' },
    section: { marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '5px' },
    heading: { marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    formGroup: { marginBottom: '15px' },
    label: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    input: { width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '5px' },
    button: { padding: '10px 15px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', marginRight: '10px' },
    buttonDisabled: { backgroundColor: '#ccc', cursor: 'not-allowed' },
    error: { color: 'red', marginTop: '10px' },
    success: { color: 'green', marginTop: '10px' },
    txList: { listStyle: 'none', padding: 0 },
    txItem: { borderBottom: '1px solid #eee', padding: '10px 0', marginBottom: '10px' },
    txDetail: { display: 'block', fontSize: '0.9em', color: '#555' },
    walletButtonContainer: { marginBottom: '20px' }
};

const PaymentComponent: React.FC = () => {
    const { connection } = useConnection(); // Use hook for connection
    const wallet = useWallet();
    const { publicKey, connected } = wallet;

    const [program, setProgram] = useState<Program<PeerToPeerPayment> | null>(null);
    const [receiver, setReceiver] = useState<string>('');
    const [amountSOL, setAmountSOL] = useState<string>('');
    const [memo, setMemo] = useState<string>('');
    const [transactionHistory, setTransactionHistory] = useState<TransactionRecordAccount[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initialize Program instance when wallet connects
    useEffect(() => {
        if (connected && connection && wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
            try {
                // Use the existing connection from the hook
                const provider = getProvider(connection, wallet);
                const loadedProgram = getProgram(provider, PROGRAM_ID);
                setProgram(loadedProgram);
                setError(null); // Clear previous errors on successful connection
                console.log("Program loaded successfully.");
            } catch (err) {
                console.error("Failed to get provider or program:", err);
                setError(err instanceof Error ? err.message : "Failed to initialize program. Is your wallet connected properly?");
                setProgram(null);
            }
        } else {
            setProgram(null); // Reset program if wallet disconnects
        }
    }, [connected, connection, wallet]); // Re-run when connection or wallet state changes

    // Fetch transaction history
    const fetchHistory = useCallback(async () => {
        if (!program || !publicKey) {
            // setError("Cannot fetch history: Program not loaded or wallet not connected.");
            console.log("Skipping history fetch: Program not loaded or wallet not connected.");
            return;
        }

        setIsFetchingHistory(true);
        setError(null);
        try {
            console.log(`Fetching history for ${publicKey.toBase58()}...`);
            const history = await getTransactionHistory(program.provider.connection, program, publicKey);
            setTransactionHistory(history);
            console.log("History fetched:", history);
        } catch (err) {
            console.error("Failed to fetch transaction history:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch transaction history.");
            setTransactionHistory([]); // Clear history on error
        } finally {
            setIsFetchingHistory(false);
        }
    }, [program, publicKey]); // Dependencies: program instance and user's public key

    // Fetch history when program is loaded or publicKey changes
    useEffect(() => {
        if (program && publicKey) {
            fetchHistory();
        } else {
            setTransactionHistory([]); // Clear history if disconnected or program not loaded
        }
    }, [program, publicKey, fetchHistory]);

    // Handle payment submission
    const handleSendPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!program || !publicKey || !receiver || !amountSOL) {
            setError("Please connect wallet, enter receiver address, and amount.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const receiverPublicKey = new PublicKey(receiver);
            const amountLamports = new BN(parseFloat(amountSOL) * LAMPORTS_PER_SOL);

            if (amountLamports.isZero() || amountLamports.isNeg()) {
                throw new Error("Amount must be positive.");
            }

            console.log(`Sending ${amountSOL} SOL to ${receiver} with memo "${memo}"`);

            const txSignature = await sendPaymentTransaction(
                program,
                publicKey,
                receiverPublicKey,
                amountLamports,
                memo
            );

            setSuccessMessage(`Payment successful! Transaction Signature: ${txSignature}`);
            console.log("Payment successful, signature:", txSignature);

            // Clear form and refresh history
            setReceiver('');
            setAmountSOL('');
            setMemo('');
            await fetchHistory(); // Refresh history after successful payment

        } catch (err) {
            console.error("Payment failed:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred during payment.");
            setSuccessMessage(null);
        } finally {
            setIsLoading(false);
        }
    };

    const isFormValid = useMemo(() => {
        try {
            if (!receiver || !amountSOL) return false;
            new PublicKey(receiver); // Validate receiver address format
            const amountNum = parseFloat(amountSOL);
            return !isNaN(amountNum) && amountNum > 0;
        } catch {
            return false; // Invalid PublicKey format
        }
    }, [receiver, amountSOL]);

    return (
        <div style={styles.container}>
            <h1>Solana P2P Payments</h1>

            <div style={styles.walletButtonContainer}>
                <WalletMultiButton />
            </div>

            {!connected && <p>Please connect your wallet to proceed.</p>}

            {error && <p style={styles.error}>Error: {error}</p>}
            {successMessage && <p style={styles.success}>{successMessage}</p>}

            {connected && program && publicKey && (
                <>
                    <div style={styles.section}>
                        <h2 style={styles.heading}>Send Payment</h2>
                        <form onSubmit={handleSendPayment}>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="receiver">Receiver Address:</label>
                                <input
                                    style={styles.input}
                                    type="text"
                                    id="receiver"
                                    value={receiver}
                                    onChange={(e) => setReceiver(e.target.value)}
                                    placeholder="Enter receiver's Solana address"
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="amount">Amount (SOL):</label>
                                <input
                                    style={styles.input}
                                    type="number"
                                    id="amount"
                                    value={amountSOL}
                                    onChange={(e) => setAmountSOL(e.target.value)}
                                    placeholder="e.g., 0.1"
                                    step="any"
                                    min="0.000000001" // Smallest unit technically
                                    required
                                    disabled={isLoading}
                                />
                            </div>
                            <div style={styles.formGroup}>
                                <label style={styles.label} htmlFor="memo">Memo (Optional):</label>
                                <input
                                    style={styles.input}
                                    type="text"
                                    id="memo"
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="e.g., Payment for invoice #123"
                                    maxLength={200} // Match potential program constraints
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                style={isLoading || !isFormValid ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
                                disabled={isLoading || !isFormValid}
                            >
                                {isLoading ? 'Sending...' : 'Send Payment'}
                            </button>
                        </form>
                    </div>

                    <div style={styles.section}>
                        <h2 style={styles.heading}>Your Transaction History</h2>
                        <button
                            onClick={fetchHistory}
                            style={isFetchingHistory ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
                            disabled={isFetchingHistory}
                        >
                            {isFetchingHistory ? 'Refreshing...' : 'Refresh History'}
                        </button>
                        {isFetchingHistory && <p>Loading history...</p>}
                        {!isFetchingHistory && transactionHistory.length === 0 && (
                            <p>No transactions found for your address.</p>
                        )}
                        {!isFetchingHistory && transactionHistory.length > 0 && (
                            <ul style={styles.txList}>
                                {transactionHistory.map((tx, index) => (
                                    <li key={index} style={styles.txItem}>
                                        <div><strong>To:</strong> {tx.receiver.toBase58()}</div>
                                        <div><strong>Amount:</strong> {(tx.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(9)} SOL</div>
                                        <div><strong>Memo:</strong> {tx.memo || <i>No memo</i>}</div>
                                        <div style={styles.txDetail}>
                                            <strong>Timestamp:</strong> {new Date(tx.timestamp.toNumber() * 1000).toLocaleString()}
                                        </div>
                                        {/* Optional: Link to explorer */}
                                        {/* <a href={`https://explorer.solana.com/tx/...signature...?cluster=${SOLANA_NETWORK}`} target="_blank" rel="noopener noreferrer">View on Explorer</a> */}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
             {!program && connected && !error && <p>Initializing program...</p>}
        </div>
    );
};

export default PaymentComponent;