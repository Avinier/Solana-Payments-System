#!/bin/bash

# Exit script on error
set -e

echo "Building Anchor program..."
anchor build

echo "Deploying Anchor program to devnet..."
# You might need to run `solana config set --url devnet` first if not already set
# Or specify the keypair path if not using the default: anchor deploy --provider.cluster devnet --provider.wallet <PATH_TO_YOUR_WALLET>
anchor deploy --provider.cluster devnet

echo "Deployment complete."
echo "Program ID can be found in target/deploy/<PROGRAM_NAME>-keypair.json"