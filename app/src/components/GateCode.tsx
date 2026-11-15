"use client";
import { useEffect, useState } from "react";
import nacl from "tweetnacl";
import bs58 from "bs58";
import QRCode from "qrcode";
import { SESSION_SECS, WINDOW_SECS, makeCode, sessionMessage } from "@/lib/gate";
import type { AppWallet } from "@/lib/useAppWallet";

const btn = "grad rounded-xl px-6 py-3 text-lg font-semibold text-black disabled:opacity-40";
const nowSecs = () => Math.floor(Date.now() / 1000);

type Session = { eph: nacl.SignKeyPair; expires: number; walletSig: Uint8Array };

export default function GateCode({ ticket, wallet }: { ticket: string; wallet: AppWallet }) {
  // The ephemeral secret lives only in this component's state.
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(nowSecs());
  const [qr, setQr] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNow(nowSecs()), 1000);
    return () => clearInterval(id);
  }, [session]);

  const live = session && now < session.expires ? session : null;
  const n = Math.floor(now / WINDOW_SECS);
  const code = live && wallet.publicKey
    ? makeCode({ ticket, wallet: wallet.publicKey.toBase58(), ephemeral: live.eph, expires: live.expires, walletSig: live.walletSig, now })
    : "";
  useEffect(() => { if (code) QRCode.toDataURL(code, { margin: 1, width: 300, errorCorrectionLevel: "L" }).then(setQr).catch(() => setQr("")); }, [code, n]);

  async function start() {
    setMsg("");
    try {
      if (!wallet.signMessage || !wallet.publicKey) throw new Error("This wallet can't sign messages");
      const eph = nacl.sign.keyPair();
      const expires = nowSecs() + SESSION_SECS;
      const text = sessionMessage({ ticket, ephemeralPubkey: bs58.encode(eph.publicKey), expires, origin: window.location.origin });
      const walletSig = await wallet.signMessage(new TextEncoder().encode(text));
      setNow(nowSecs());
      setSession({ eph, expires, walletSig });
    } catch (e: any) { setMsg(e?.message ?? String(e)); }
  }

  return (
    <div className="w-full space-y-3">
      <button className={btn} onClick={start}>{session && !live ? "Sign again" : session ? "Restart gate session" : "Show gate code"}</button>
      {msg && <p className="text-red-300">{msg}</p>}
      {session && !live && <p className="text-amber-300">Gate session expired. Sign again to get a new code.</p>}
      {live && (
        <div className="space-y-3">
          {qr && <img src={qr} alt="Gate code QR" className="rounded-xl bg-white p-2" width={300} height={300} />}
          <p className="text-lg">New code in <b>{WINDOW_SECS - (now % WINDOW_SECS)}s</b> · session ends in {Math.max(0, Math.ceil((live.expires - now) / 60))} min</p>
          <textarea readOnly value={code} rows={4} className="w-full select-all rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-sm" />
          <button className={btn} onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
