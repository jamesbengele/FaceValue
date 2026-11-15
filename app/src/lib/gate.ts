// Rotating gate code (SPEC §7). Pure functions: no React, no chain access.
import nacl from "tweetnacl";
import bs58 from "bs58";

export const WINDOW_SECS = 30;
export const SESSION_SECS = 15 * 60;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64u = (b: Uint8Array) => {
  let s = ""; b.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export const windowOf = (now: number) => Math.floor(now / WINDOW_SECS);
const windowMessage = (ticket: string, n: number) => enc.encode(`ticket:${ticket}.window:${n}`);

export function sessionMessage(p: { ticket: string; ephemeralPubkey: string; expires: number; origin: string }): string {
  return `FaceValue gate session\nticket:${p.ticket}\nkey:${p.ephemeralPubkey}\nexpires:${p.expires}\norigin:${p.origin}`;
}

export function makeCode(p: {
  ticket: string; wallet: string; ephemeral: nacl.SignKeyPair; expires: number; walletSig: Uint8Array; now: number;
}): string {
  const n = windowOf(p.now);
  const g = nacl.sign.detached(windowMessage(p.ticket, n), p.ephemeral.secretKey);
  const body = { t: p.ticket, w: p.wallet, k: bs58.encode(p.ephemeral.publicKey), e: p.expires, s: bs58.encode(p.walletSig), n, g: bs58.encode(g) };
  return toB64u(enc.encode(JSON.stringify(body)));
}

export type GateResult = { ok: true; ticket: string; wallet: string } | { ok: false; reason: string };

export function verifyCode(code: string, ctx: { now: number; origin: string }): GateResult {
  let c: any;
  try { c = JSON.parse(dec.decode(fromB64u(code.trim()))); } catch { return { ok: false, reason: "Code is not readable" }; }
  const strs = ["t", "w", "k", "s", "g"];
  if (!c || strs.some((k) => typeof c[k] !== "string") || !Number.isInteger(c.e) || !Number.isInteger(c.n))
    return { ok: false, reason: "Code is malformed" };
  try {
    const msg = enc.encode(sessionMessage({ ticket: c.t, ephemeralPubkey: c.k, expires: c.e, origin: ctx.origin }));
    if (!nacl.sign.detached.verify(msg, bs58.decode(c.s), bs58.decode(c.w)))
      return { ok: false, reason: "Wallet signature invalid (or code is for another origin)" };
    if (!nacl.sign.detached.verify(windowMessage(c.t, c.n), bs58.decode(c.g), bs58.decode(c.k)))
      return { ok: false, reason: "Code signature invalid" };
  } catch { return { ok: false, reason: "Code is malformed" }; }
  if (c.e <= ctx.now) return { ok: false, reason: "Code session expired" };
  if (Math.abs(c.n - windowOf(ctx.now)) > 1) return { ok: false, reason: "Code expired, ask the holder for a fresh one" };
  return { ok: true, ticket: c.t, wallet: c.w };
}
