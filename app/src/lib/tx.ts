import { Connection, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { SimError } from "./errors";
import type { AppWallet } from "./privyWallet";

// Simulate first. If the program rejects, throw before the wallet is ever asked to sign.
export async function simulateThenSend(connection: Connection, wallet: AppWallet, ixs: TransactionInstruction[]) {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Connect your wallet first");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({ payerKey: wallet.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message()
  );
  const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" });
  if (sim.value.err) throw new SimError(sim.value.logs ?? [], sim.value.err);
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error("Transaction failed: " + JSON.stringify(res.value.err));
  return sig;
}
