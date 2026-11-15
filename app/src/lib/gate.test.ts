import assert from "node:assert";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { makeCode, sessionMessage, verifyCode, windowOf } from "./gate";

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
assert.deepStrictEqual(ok, { ok: true, ticket, wallet: bs58.encode(wallet.publicKey) });
// tampered ticket field
assert.strictEqual(verifyCode(pack({ ...parse(mk()), t: bs58.encode(nacl.randomBytes(32)) }), ctx).ok, false);
// wrong ephemeral key (code signed by a different key than the one the wallet approved)
assert.strictEqual(verifyCode(mk({ ephemeral: nacl.sign.keyPair() }), ctx).ok, false);
// expired session
assert.strictEqual(verifyCode(mk(), { now: expires + 1, origin }).ok, false);
// windows: n-2 fails, n-1 / n+1 pass (code made at time shifted by whole windows)
assert.strictEqual(verifyCode(mk({ now: now - 60 }), ctx).ok, false);
assert.strictEqual(verifyCode(mk({ now: now - 30 }), ctx).ok, true);
assert.strictEqual(verifyCode(mk({ now: now + 30 }), ctx).ok, true);
assert.strictEqual(verifyCode(mk({ now: now + 60 }), ctx).ok, false);
assert.strictEqual(windowOf(now), parse(mk()).n);
// wrong origin
assert.strictEqual(verifyCode(mk(), { now, origin: "https://evil.example" }).ok, false);
// garbage
assert.strictEqual(verifyCode("!!!", ctx).ok, false);
console.log("gate tests passed");
