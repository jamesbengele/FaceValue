// DEVNET DEMO. Storage is in usernameStore: Redis when configured (needed on Vercel), else a JSON file.
// A name is bound to a wallet by an ed25519 signature over `FaceValue username: <name>`.
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { normalizeUsername, usernameError, usernameMessage } from "@/lib/usernames";
import { usernameStore } from "@/lib/usernameStore";
import { PrivyClient } from "@privy-io/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Optional: with PRIVY_APP_SECRET set, a Privy access token links the name to the email account as well as the wallet.
const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID, APP_SECRET = process.env.PRIVY_APP_SECRET;
const privy = APP_ID && APP_SECRET ? new PrivyClient(APP_ID, APP_SECRET) : null;
async function privyUser(req: Request): Promise<{ id: string; wallets: string[] } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!privy || !token) return null;
  try {
    const { userId } = await privy.verifyAuthToken(token);
    const u = await privy.getUser(userId);
    return { id: userId, wallets: u.linkedAccounts.flatMap((a: any) => (a.type === "wallet" && a.address ? [a.address] : [])) };
  } catch { return null; }
}

const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("addresses") ?? "").split(",").filter((a) => ADDR.test(a)).slice(0, 200);
  try {
    const names = await usernameStore.get(list);
    // Signed-in user whose wallet has no name yet but whose account has one: bind it (the token proves the account owns the wallet).
    const me = new URL(req.url).searchParams.get("me");
    if (me && ADDR.test(me) && !names[me]) {
      const u = await privyUser(req);
      const saved = u && u.wallets.includes(me) ? await usernameStore.getByPrivy(u.id) : null;
      if (saved && (await usernameStore.set(me, saved))) names[me] = saved;
    }
    return NextResponse.json(names);
  }
  catch { return NextResponse.json({ error: "Username store unavailable" }, { status: 503 }); }
}

export async function POST(req: Request) {
  let address: PublicKey, name: string, sig: Uint8Array;
  try {
    const b = await req.json();
    if (typeof b?.address !== "string" || !ADDR.test(b.address) || typeof b?.username !== "string" || typeof b?.signature !== "string") throw new Error("bad");
    address = new PublicKey(b.address); name = normalizeUsername(b.username); sig = Uint8Array.from(Buffer.from(b.signature, "base64"));
  } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const bad = usernameError(name);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (!nacl.sign.detached.verify(new TextEncoder().encode(usernameMessage(name)), sig, address.toBytes()))
    return NextResponse.json({ error: "Signature does not match this wallet" }, { status: 403 });
  try {
    if (!(await usernameStore.set(address.toBase58(), name))) return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  } catch { return NextResponse.json({ error: "Could not save the username, try again" }, { status: 503 }); }
  const u = await privyUser(req);
  if (u && u.wallets.includes(address.toBase58())) { try { await usernameStore.setByPrivy(u.id, name); } catch { /* wallet link still saved */ } }
  return NextResponse.json({ ok: true, username: name });
}
