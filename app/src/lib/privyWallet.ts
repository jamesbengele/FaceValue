"use client";
// Privy embedded Solana wallet adapted to the AppWallet shape. Only call inside <PrivyProvider>.
import { useCallback, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

type Tx = Transaction | VersionedTransaction;
export interface AppWallet {
  publicKey: PublicKey | null;
  signTransaction: (<T extends Tx>(tx: T) => Promise<T>) | undefined;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
}

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
  const signMsg = useCallback(async (message: Uint8Array) => {
    const { w, signMessage } = live.current;
    if (!w) throw new Error("Email wallet not ready");
    return (await signMessage({ message, wallet: w })).signature;
  }, []);

  const address = w?.address;
  const publicKey = useMemo(() => (address ? new PublicKey(address) : null), [address]);
  const wallet = useMemo<AppWallet | null>(
    () => (authenticated && publicKey ? { publicKey, signTransaction: signTx, signMessage: signMsg } : null),
    [authenticated, publicKey, signTx, signMsg]
  );
  const auth = useMemo<EmailAuth>(
    () => ({ ready, authenticated, login: () => login({ loginMethods: ["email"] }), logout: () => { logout(); } }),
    [ready, authenticated, login, logout]
  );
  return { wallet, auth };
}

// Email (Privy) is the only sign-in method; signed out means no publicKey and no signers.
export function useAppWallet(): AppWallet & { emailAuth: EmailAuth | null } {
  const { wallet, auth } = usePrivySide();
  return wallet
    ? { ...wallet, emailAuth: auth }
    : { publicKey: null, signTransaction: undefined, emailAuth: auth };
}
