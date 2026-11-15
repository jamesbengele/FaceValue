"use client";
// Privy embedded Solana wallet adapted to the AppWallet shape. Only call inside <PrivyProvider>.
import { useCallback, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { AppWallet } from "./useAppWallet";

export type EmailAuth = { ready: boolean; authenticated: boolean; login: () => void; logout: () => void };
export type PrivySide = { wallet: AppWallet | null; auth: EmailAuth | null };

export function usePrivySide(): PrivySide {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { signTransaction } = useSignTransaction();
  const w = wallets.find((x) => (x as any).standardWallet?.name === "Privy") ?? wallets[0];

  // Privy's hook functions may change identity every render; the callbacks below must stay stable (the app memoizes on them).
  const live = useRef({ w, signMessage, signTransaction });
  live.current = { w, signMessage, signTransaction };

  const signTx = useCallback(async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    const { w, signTransaction } = live.current;
    if (!w) throw new Error("Email wallet not ready");
    // Privy takes and returns serialized bytes; convert at this seam.
    const isV0 = "version" in tx;
    const bytes = isV0
      ? (tx as VersionedTransaction).serialize()
      : (tx as Transaction).serialize({ requireAllSignatures: false, verifySignatures: false });
    const { signedTransaction } = await signTransaction({ transaction: bytes, wallet: w, chain: "solana:devnet" });
    return (isV0 ? VersionedTransaction.deserialize(signedTransaction) : Transaction.from(signedTransaction)) as T;
  }, []);
  const signAll = useCallback(async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
    const out: T[] = [];
    for (const t of txs) out.push(await signTx(t));
    return out;
  }, [signTx]);
  const signMsg = useCallback(async (message: Uint8Array) => {
    const { w, signMessage } = live.current;
    if (!w) throw new Error("Email wallet not ready");
    return (await signMessage({ message, wallet: w })).signature;
  }, []);

  const address = w?.address;
  const publicKey = useMemo(() => (address ? new PublicKey(address) : null), [address]);
  const wallet = useMemo<AppWallet | null>(
    () => (authenticated && publicKey ? { publicKey, signTransaction: signTx, signAllTransactions: signAll, signMessage: signMsg, kind: "email" } : null),
    [authenticated, publicKey, signTx, signAll, signMsg]
  );
  const auth = useMemo<EmailAuth>(
    () => ({ ready, authenticated, login: () => login({ loginMethods: ["email"] }), logout: () => { logout(); } }),
    [ready, authenticated, login, logout]
  );
  return { wallet, auth };
}
