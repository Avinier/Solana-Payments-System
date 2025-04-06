# Solana P2P Payment System

A peer-to-peer payment system built on the Solana blockchain using the Anchor framework. This project allows users to send SOL between wallets, track transaction history, and include payment memos/references.

**Project for Distributed Computing (DC)**
Created by:

- c181 Aditya Subramanian
- c170 Anirudh Pathak
- c166 Aman Khatri
- c194 Utsav Chougule

## Setup

1.  **Prerequisites:**

    - Install Rust: [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install)
    - Install Solana Tool Suite: [https://docs.solana.com/cli/install-solana-cli-tools](https://docs.solana.com/cli/install-solana-cli-tools)
    - Install Anchor: [https://www.anchor-lang.com/docs/installation](https://www.anchor-lang.com/docs/installation)
    - Install Node.js and Yarn: [https://nodejs.org/](https://nodejs.org/), [https://yarnpkg.com/getting-started/install](https://yarnpkg.com/getting-started/install)

2.  **Clone the repository:**

    ```bash
    git clone <your-repo-url>
    cd solana-p2p-payment-system
    ```

3.  **Install frontend dependencies:**

    ```bash
    cd app
    yarn install
    cd ..
    ```

4.  **Build the Solana program:**

    ```bash
    anchor build
    ```

5.  **Run local validator (optional, for testing):**

    ```bash
    solana-test-validator
    ```

6.  **Deploy the program (to localnet or devnet):**

    - Update `Anchor.toml` with your keypair path and desired network (e.g., `provider.cluster = "devnet"`).
    - Run: `anchor deploy` (You might need to run `anchor build` again first). Note the program ID.
    - Update the program ID in `app/src/solanaUtils.ts` and potentially other relevant frontend files.

7.  **Start the frontend application:**
    ```bash
    cd app
    yarn dev
    ```

## Usage

1.  Connect your Solana wallet (e.g., Phantom) to the application. Ensure you are on the correct network (localnet/devnet/mainnet-beta) where the program is deployed.
2.  Enter the recipient's wallet address.
3.  Enter the amount of SOL to send.
4.  Optionally, add a memo or reference for the transaction.
5.  Click "Send Payment".
6.  Approve the transaction in your wallet.
7.  View your transaction history within the application.

## Architecture

- **Solana Program (Smart Contract):** Located in `programs/my_first_transaction`. Written in Rust using the Anchor framework. Handles the core logic of transferring SOL and potentially storing transaction metadata on-chain (depending on implementation).
- **Frontend:** Located in `app/`. Built with React/Next.js (or similar framework) and TypeScript. Interacts with the user's wallet (e.g., Phantom) and the Solana blockchain via `@solana/web3.js` and Anchor's client libraries.
- **Anchor Framework:** Simplifies Solana program development by providing a Rust eDSL, IDL generation, client generation, and testing utilities.

## Distributed Computing Principles Applied

This project leverages several distributed computing concepts inherent to blockchain technology:

- **Decentralization:** Transactions are processed and validated by a distributed network of nodes, eliminating reliance on a single central authority.
- **Consensus:** Solana uses a consensus mechanism (Proof-of-History combined with Proof-of-Stake) to ensure all nodes agree on the state of the ledger and the validity of transactions.
- **Fault Tolerance:** The distributed nature of the network allows it to continue operating even if some nodes fail or become unavailable.
- **Transparency:** All transactions are recorded on the public ledger, providing transparency (though user identities are pseudonymous).
