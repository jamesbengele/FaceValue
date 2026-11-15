"use client";
import { useMemo } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";
import { PrivyProvider } from "@privy-io/react-auth";
import { defaultSolanaRpcsPlugin } from "@privy-io/react-auth/solana";
import { RPC_URL } from "@/lib/config";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Anchor's BN/serialization expects a global Buffer in the browser.
if (typeof window !== "undefined") (window as any).Buffer ??= Buffer;

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const tree = (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
  if (!PRIVY_APP_ID) return tree; // Phantom only, exactly as before
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet", "email"],
        embeddedWallets: { solana: { createOnLogin: "all-users" }, showWalletUIs: false },
        plugins: [defaultSolanaRpcsPlugin()],
      }}
    >
      {tree}
    </PrivyProvider>
  );
}
