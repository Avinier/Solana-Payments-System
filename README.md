# Solana P2P Payment System

A peer-to-peer payment system built on the Solana blockchain using the Anchor framework. This project allows users to send SOL between wallets, track transaction history, and include payment memos/references.

**Project for Distributed Computing (DC)**
Created by:

- c181 Aditya Subramanian
- c170 Anirudh Pathak
- c166 Aman Khatri
- c194 Utsav Chougule

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
