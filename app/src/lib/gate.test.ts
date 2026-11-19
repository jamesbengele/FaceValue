import assert from "node:assert";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { WINDOW_SECS, makeCode, sessionMessage, verifyCode, windowOf } from "./gate";

const origin = "https://fv.example";
const now = 1_700_000_000;
const wallet = nacl.sign.keyPair();
const eph = nacl.sign.keyPair();
const ticket = bs58.encode(nacl.randomBytes(32));
const expires = now + 900;
const msg = sessionMessage({ ticket, ephemeralPubkey: bs58.encode(eph.publicKey), expires, origin });
assert.strictEqual(msg, `FaceValue gate session\nticket:${ticket}\nkey:${bs58.encode(eph.publicKey)}\nexpires:${expires}\norigin:${origin}`);
const walletSig = nacl.sign.detached(new TextEncoder().encode(msg), wallet.secretKey);
const mk = (o: any = {}) => makeCode({ ticket, wallet: bs58.encode(wallet.publicKey), ephemeral: eph, expires, walletSig, now, ...o });
const ctx = { now, origin };
const parse = (c: string) => JSON.parse(Buffer.from(c, "base64url").toString());
const pack = (o: any) => Buffer.from(JSON.stringify(o)).toString("base64url");

// valid
const ok = verifyCode(mk(), ctx);
assert.deepStrictEqual(ok, { ok: true, ticket, wallet: bs58.encode(wallet.publicKey), validUntil: (windowOf(now) + 2) * WINDOW_SECS });
// tampered ticket field
assert.strictEqual(verifyCode(pack({ ...parse(mk()), t: bs58.encode(nacl.randomBytes(32)) }), ctx).ok, false);
// wrong ephemeral key (code signed by a different key than the one the wallet approved)
assert.strictEqual(verifyCode(mk({ ephemeral: nacl.sign.keyPair() }), ctx).ok, false);
// expired session
assert.strictEqual(verifyCode(mk(), { now: expires + 1, origin }).ok, false);
// windows: n-2 fails, n-1 / n+1 pass (code made at time shifted by whole windows)
assert.strictEqual(verifyCode(mk({ now: now - 2 * WINDOW_SECS }), ctx).ok, false);
assert.strictEqual(verifyCode(mk({ now: now - WINDOW_SECS }), ctx).ok, true);
assert.strictEqual(verifyCode(mk({ now: now + WINDOW_SECS }), ctx).ok, true);
assert.strictEqual(verifyCode(mk({ now: now + 2 * WINDOW_SECS }), ctx).ok, false);
assert.strictEqual(windowOf(now), parse(mk()).n);
// wrong origin
assert.strictEqual(verifyCode(mk(), { now, origin: "https://evil.example" }).ok, false);
// a session longer than 15 min (+2 windows of slack) is refused even though the wallet signed it
const sessionSig = (e: number) => nacl.sign.detached(new TextEncoder().encode(sessionMessage({ ticket, ephemeralPubkey: bs58.encode(eph.publicKey), expires: e, origin })), wallet.secretKey);
assert.strictEqual(verifyCode(mk({ expires: now + 900 + 2 * WINDOW_SECS, walletSig: sessionSig(now + 900 + 2 * WINDOW_SECS) }), ctx).ok, true);
assert.deepStrictEqual(verifyCode(mk({ expires: now + 901 + 2 * WINDOW_SECS, walletSig: sessionSig(now + 901 + 2 * WINDOW_SECS) }), ctx), { ok: false, reason: "Code session is too long" });
// garbage
assert.strictEqual(verifyCode("!!!", ctx).ok, false);
console.log("gate tests passed");

// QR link round-trip: a scanned link and a bare code both give back the code.
{
  const { codeUrl, codeFromScan } = require("./gate");
  const code = makeCode({ ticket, wallet: bs58.encode(wallet.publicKey), ephemeral: eph, expires, walletSig: nacl.sign.detached(new TextEncoder().encode(msg), wallet.secretKey), now });
  assert.strictEqual(codeFromScan(codeUrl(origin, code)), code);
  assert.strictEqual(codeFromScan(`  ${code}\n`), code);
  assert.ok(verifyCode(codeFromScan(codeUrl(origin, code)), { now, origin }).ok);
  console.log("gate: QR link round-trip ok");
}

// A screenshot dies within 20 s: a code made at the very start of its window fails 20 s later.
{
  const start = windowOf(now) * WINDOW_SECS;
  const shot = mk({ now: start });
  assert.strictEqual(verifyCode(shot, { now: start + 19, origin }).ok, true);
  assert.strictEqual(verifyCode(shot, { now: start + 20, origin }).ok, false);
  console.log("gate: screenshot lifetime ok");
}

// A code made on another allowed site (laptop dev server) verifies on the public check page; others don't.
{
  const { verifyCodeAny } = require("./gate");
  assert.ok(verifyCodeAny(mk(), { now, origins: ["https://public.example", origin] }).ok);
  assert.strictEqual(verifyCodeAny(mk(), { now, origins: ["https://public.example"] }).ok, false);
  console.log("gate: extra origins ok");
}
