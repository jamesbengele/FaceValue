// DEVNET DEMO. Usernames live in a JSON file on this server, so this works on one machine, not on a serverless host.
// A name is bound to a wallet by an ed25519 signature over `FaceValue username: <name>`.
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import * as fs from "fs";
import * as path from "path";
import { normalizeUsername, usernameError, usernameMessage } from "@/lib/usernames";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILE = process.env.USERNAMES_FILE || path.resolve(process.cwd(), ".data/usernames.json");
const read = (): Record<string, string> => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (m: Record<string, string>) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(m, null, 2)); };
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(req: Request) {
  const list = (new URL(req.url).searchParams.get("addresses") ?? "").split(",").filter((a) => ADDR.test(a)).slice(0, 200);
  const all = read();
  return NextResponse.json(Object.fromEntries(list.filter((a) => all[a]).map((a) => [a, all[a]])));
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
  const all = read(), me = address.toBase58();
  if (Object.entries(all).some(([a, n]) => n === name && a !== me)) return NextResponse.json({ error: "That username is taken" }, { status: 409 });
  all[me] = name; write(all);
  return NextResponse.json({ ok: true, username: name });
}
