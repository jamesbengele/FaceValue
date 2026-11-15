"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

type Tx = Transaction | VersionedTransaction;
export interface AppWallet {
  publicKey: PublicKey | null;
  signTransaction: (<T extends Tx>(tx: T) => Promise<T>) | undefined;
  signAllTransactions: (<T extends Tx>(txs: T[]) => Promise<T[]>) | undefined;
}

// The one seam for sign-in methods: Phantom today; a Privy embedded wallet can return the same shape later.
export function useAppWallet(): AppWallet {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  return { publicKey, signTransaction, signAllTransactions };
}
