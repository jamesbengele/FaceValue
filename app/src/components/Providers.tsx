"use client";
import { Buffer } from "buffer";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { PrivyProvider } from "@privy-io/react-auth";
import { defaultSolanaRpcsPlugin } from "@privy-io/react-auth/solana";
import { RPC_URL } from "@/lib/config";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// Anchor's BN/serialization expects a global Buffer in the browser.
if (typeof window !== "undefined") (window as any).Buffer ??= Buffer;

export default function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID)
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h1 className="text-2xl font-bold">Email sign-in isn&apos;t configured</h1>
          <p className="mt-2 text-zinc-400">Set NEXT_PUBLIC_PRIVY_APP_ID in app/.env.local and restart.</p>
        </section>
      </main>
    );
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        embeddedWallets: { solana: { createOnLogin: "all-users" }, showWalletUIs: false },
        plugins: [defaultSolanaRpcsPlugin()],
      }}
    >
      <ConnectionProvider endpoint={RPC_URL}>{children}</ConnectionProvider>
    </PrivyProvider>
  );
}
