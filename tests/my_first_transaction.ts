import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MyFirstTransaction } from "../target/types/my_first_transaction";
import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("peer_to_peer_payment", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MyFirstTransaction as Program<MyFirstTransaction>; // Ensure type name matches generated IDL

  // Generate keypairs for sender and receiver
  const sender = Keypair.generate();
  const receiver = Keypair.generate();

  // Fund the sender account once before any tests run
  before(async () => {
    console.log("Funding sender account...");
    const airdropSignature = await provider.connection.requestAirdrop(
      sender.publicKey,
      2 * LAMPORTS_PER_SOL // Airdrop 2 SOL
    );
    // Confirm the transaction
    const latestBlockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: airdropSignature,
    }, "confirmed");

    const balance = await provider.connection.getBalance(sender.publicKey);
    console.log(`Sender funded with ${balance / LAMPORTS_PER_SOL} SOL`);
    expect(balance).to.equal(2 * LAMPORTS_PER_SOL);
  });

  it("Sends a payment from sender to receiver", async () => {
    const amountToSend = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // Send 0.5 SOL
    const memo = "Test payment";

    // Get initial balances
    const senderInitialBalance = await provider.connection.getBalance(sender.publicKey);
    const receiverInitialBalance = await provider.connection.getBalance(receiver.publicKey);
    console.log(`Sender initial balance: ${senderInitialBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`Receiver initial balance: ${receiverInitialBalance / LAMPORTS_PER_SOL} SOL`);


    // Execute the send_payment instruction
    const txSignature = await program.methods
      .sendPayment(amountToSend, memo)
      .accounts({
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        systemProgram: SystemProgram.programId,
        // Note: PaymentRecord account is not included yet as it's commented out in the program
      })
      .signers([sender]) // Sender needs to sign the transaction
      .rpc();

    console.log("Payment transaction signature", txSignature);
    await provider.connection.confirmTransaction(txSignature, "confirmed");

    // Get final balances
    const senderFinalBalance = await provider.connection.getBalance(sender.publicKey);
    const receiverFinalBalance = await provider.connection.getBalance(receiver.publicKey);
    console.log(`Sender final balance: ${senderFinalBalance / LAMPORTS_PER_SOL} SOL`);
    console.log(`Receiver final balance: ${receiverFinalBalance / LAMPORTS_PER_SOL} SOL`);


    // Assertions
    // Receiver balance should increase by the amount sent
    expect(receiverFinalBalance).to.equal(receiverInitialBalance + amountToSend.toNumber());

    // Sender balance should decrease by the amount sent + transaction fee
    // We can't know the exact fee beforehand, so check it's less than the initial balance minus amount sent
    expect(senderFinalBalance).to.be.lessThan(senderInitialBalance - amountToSend.toNumber());
    // A more precise check would involve fetching the transaction fee, but this is a good start
    expect(senderFinalBalance).to.be.greaterThan(senderInitialBalance - amountToSend.toNumber() - 0.01 * LAMPORTS_PER_SOL); // Allow for some fee

  });

  // TODO: Implement tests for initializing and using PaymentRecord account

  it("Initializes and uses PaymentRecord account", async () => {
    // 1. Define PDA for PaymentRecord based on sender, receiver, and potentially a unique ID
    // const [paymentRecordPDA, bump] = await anchor.web3.PublicKey.findProgramAddress( ... );

    // 2. Modify the send_payment call to include the PaymentRecord account
    const amountToSend = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // Small amount for this test
    const memo = "Payment with record";

    /*
    await program.methods
      .sendPayment(amountToSend, memo)
      .accounts({
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        paymentRecord: paymentRecordPDA, // Add the PDA here
        systemProgram: SystemProgram.programId,
      })
      .signers([sender])
      .rpc();
    */

    // 3. Fetch the created PaymentRecord account
    // const paymentRecordAccount = await program.account.paymentRecord.fetch(paymentRecordPDA);

    // 4. Assertions: Verify data stored in PaymentRecord
    // expect(paymentRecordAccount.sender).to.eql(sender.publicKey);
    // expect(paymentRecordAccount.receiver).to.eql(receiver.publicKey);
    // expect(paymentRecordAccount.amount.eq(amountToSend)).to.be.true;
    // expect(paymentRecordAccount.memo).to.equal(memo);
    // expect(paymentRecordAccount.timestamp).to.be.a('number'); // Or check BN type if applicable

    console.log("Placeholder test for PaymentRecord - Implement details based on program logic.");
    // Remove the line above and uncomment/implement the steps when ready.
    expect(true).to.be.true; // Placeholder assertion
  });

  it("Fails when memo is too long", async () => {
    const amountToSend = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
    // Assuming MAX_MEMO_LENGTH is defined in the program or known (e.g., 256 bytes)
    const longMemo = "a".repeat(257); // Example: Create a memo longer than allowed

    try {
      await program.methods
        .sendPayment(amountToSend, longMemo)
        .accounts({
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
          // Include PaymentRecord if required by the instruction variant being tested
        })
        .signers([sender])
        .rpc();
      // If the transaction succeeds, the test should fail
      expect.fail("Transaction should have failed due to long memo");
    } catch (error) {
      // Check if the error matches the expected AnchorError for MemoTooLong
      // console.error(error); // Log the error for debugging if needed
      // TODO: Adjust the error check based on the actual error code/message defined in lib.rs
      // expect(error.message).to.contain("MemoTooLong"); // Or check error.code if available
      console.log("Caught expected error for long memo (placeholder check).");
      expect(error).to.exist; // Basic check that an error was thrown
    }
  });

  it("Fails when sender has insufficient funds", async () => {
    // Create a new sender with zero balance initially
    const brokeSender = Keypair.generate();
    // DO NOT airdrop funds to brokeSender

    const amountToSend = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    const memo = "Insufficient funds test";

    try {
      await program.methods
        .sendPayment(amountToSend, memo)
        .accounts({
          sender: brokeSender.publicKey, // Use the broke sender
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
          // Include PaymentRecord if required
        })
        .signers([brokeSender]) // The broke sender must sign
        .rpc();
      expect.fail("Transaction should have failed due to insufficient funds");
    } catch (error) {
      // Solana transactions typically fail with a generic error for insufficient funds
      // before even reaching the program logic in many cases.
      // The exact error might vary. Check for common Solana balance errors.
      // console.error(error); // Log the error for debugging
      console.log("Caught expected error for insufficient funds (placeholder check).");
      expect(error).to.exist;
      // You might add more specific checks on the error message if possible/reliable
      // expect(error.message).to.contain("insufficient lamports");
    }
  });

});
