"use client";
import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { usePrivySide, type EmailAuth, type PrivySide } from "./privyWallet";

type Tx = Transaction | VersionedTransaction;
export interface AppWallet {
  publicKey: PublicKey | null;
  signTransaction: (<T extends Tx>(tx: T) => Promise<T>) | undefined;
  signAllTransactions: (<T extends Tx>(txs: T[]) => Promise<T[]>) | undefined;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
  kind?: "phantom" | "email";
}

export const PRIVY_ENABLED = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const noPrivy = (): PrivySide => ({ wallet: null, auth: null });
// Constant for the life of the build, so the hook call order never changes.
const usePrivyOrNothing = PRIVY_ENABLED ? usePrivySide : noPrivy;

// The one seam for sign-in methods: an email (Privy) wallet wins when signed in, otherwise Phantom.
export function useAppWallet(): AppWallet & { emailAuth: EmailAuth | null } {
  const { publicKey, signTransaction, signAllTransactions, signMessage } = useWallet();
  const { wallet: email, auth } = usePrivyOrNothing();
  return useMemo(
    () => (email ? { ...email, emailAuth: auth } : { publicKey, signTransaction, signAllTransactions, signMessage, kind: "phantom" as const, emailAuth: auth }),
    [email, auth, publicKey, signTransaction, signAllTransactions, signMessage]
  );
}
