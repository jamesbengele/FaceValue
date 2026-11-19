// DEVNET DEMO. Storage is in usernameStore: Redis when configured (needed on Vercel), else a JSON file.
// A name is bound to a wallet by an ed25519 signature over `FaceValue username: <name>`.
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { normalizeUsername, usernameError, usernameMessage } from "@/lib/usernames";
import { usernameStore } from "@/lib/usernameStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("addresses") ?? "").split(",").filter((a) => ADDR.test(a)).slice(0, 200);
  try { return NextResponse.json(await usernameStore.get(list)); }
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
  return NextResponse.json({ ok: true, username: name });
}
