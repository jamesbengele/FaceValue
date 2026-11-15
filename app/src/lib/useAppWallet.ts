"use client";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivySide, type EmailAuth } from "./privyWallet";

type Tx = Transaction | VersionedTransaction;
export interface AppWallet {
  publicKey: PublicKey | null;
  signTransaction: (<T extends Tx>(tx: T) => Promise<T>) | undefined;
  signAllTransactions: (<T extends Tx>(txs: T[]) => Promise<T[]>) | undefined;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
  kind?: "email";
}

// Email (Privy) is the only sign-in method; signed out means no publicKey and no signers.
export function useAppWallet(): AppWallet & { emailAuth: EmailAuth | null } {
  const { wallet, auth } = usePrivySide();
  return wallet
    ? { ...wallet, emailAuth: auth }
    : { publicKey: null, signTransaction: undefined, signAllTransactions: undefined, emailAuth: auth };
}
