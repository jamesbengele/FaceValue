// DEVNET DEMO ONLY. A real launch would need instead:
//  - fee sponsorship (a paymaster/relayer) so users never hold SOL,
//  - real USDC via a fiat on-ramp, not a server minting test tokens,
//  - authentication (verify the Privy access token or a wallet signature) and real rate-limiting
//    (this in-memory 60 s cooldown resets on restart and is per-process only).
import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const SOL_MIN = 0.02 * 1e9, SOL_SEND = 0.03 * 1e9, USDC_MIN = 50_000_000, USDC_MINT = 200_000_000;
const lastDrip = new Map<string, number>();

function serverKey(): Keypair {
  const raw = process.env.DRIP_KEYPAIR_JSON
    ?? fs.readFileSync(process.env.DEPLOYER_KEYPAIR || path.resolve(process.cwd(), "../.keys/deployer.json"), "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export async function POST(req: Request) {
  const mintStr = process.env.DEMO_MINT;
  if (!mintStr) return NextResponse.json({ error: "Test funds are not configured (DEMO_MINT unset)" }, { status: 503 });
  if (/mainnet/i.test(RPC)) return NextResponse.json({ error: "Drip is devnet-only" }, { status: 403 });

  let address: PublicKey;
  try {
    const body = await req.json();
    if (typeof body?.address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.address)) throw new Error("bad");
    address = new PublicKey(body.address);
  } catch { return NextResponse.json({ error: "Invalid address" }, { status: 400 }); }

  const key = address.toBase58();
  const wait = 60_000 - (Date.now() - (lastDrip.get(key) ?? 0));
  if (wait > 0) return NextResponse.json({ error: `Try again in ${Math.ceil(wait / 1000)}s` }, { status: 429 });
  lastDrip.set(key, Date.now());

  try {
    const kp = serverKey();
    const mint = new PublicKey(mintStr);
    const conn = new Connection(RPC, "confirmed");
    const ata = getAssociatedTokenAddressSync(mint, address);
    const [sol, ataInfo, mintInfo] = await Promise.all([conn.getBalance(address), conn.getAccountInfo(ata), getMint(conn, mint)]);
    if (!mintInfo.mintAuthority?.equals(kp.publicKey)) throw new Error("server key is not the mint authority");
    const tokens = ataInfo ? Number(ataInfo.data.readBigUInt64LE(64)) : 0; // SPL token account: amount at byte 64

    const gaveSol = sol < SOL_MIN, gaveUsdc = tokens < USDC_MIN;
    const tx = new Transaction();
    if (gaveSol) tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: address, lamports: SOL_SEND }));
    tx.add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, ata, address, mint));
    if (gaveUsdc) tx.add(createMintToInstruction(mint, ata, kp.publicKey, USDC_MINT));
    const signature = await sendAndConfirmTransaction(conn, tx, [kp]);
    return NextResponse.json({ ok: true, sol: gaveSol, usdc: gaveUsdc, signature });
  } catch (e: any) {
    lastDrip.delete(key);
    console.error("drip failed:", e?.message ?? "unknown"); // message only, never key material
    return NextResponse.json({ error: "Drip failed" }, { status: 500 });
  }
}
