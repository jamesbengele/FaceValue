"use client";
import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { verifyCode } from "@/lib/gate";

const btn = "grad rounded-xl px-6 py-3 text-lg font-semibold text-black disabled:opacity-40";

type Props = {
  program: any; pk: PublicKey | null; busy: boolean;
  checkIn: (t: { event: PublicKey; ticket: PublicKey }) => Promise<boolean>;
};

export default function Gate({ program, pk, busy, checkIn }: Props) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});

  useEffect(() => { setCanScan("BarcodeDetector" in window); return () => stop.current(); }, []);

  async function verify(code: string) {
    const fail = (t: string) => setResult({ ok: false, text: t });
    setResult(null);
    if (!pk) return fail("Connect the organizer wallet first");
    const v = verifyCode(code, { now: Math.floor(Date.now() / 1000), origin: window.location.origin });
    if (!v.ok) return fail(v.reason);
    try {
      // Re-fetch from chain; never trust page state.
      const ticketKey = new PublicKey(v.ticket);
      const t = await program.account.ticket.fetch(ticketKey);
      if (t.owner.toBase58() !== v.wallet) return fail("Wrong owner now: this wallet no longer holds the ticket");
      if (t.used) return fail("Ticket already used");
      const e = await program.account.event.fetch(t.event);
      if (!e.organizer.equals(pk)) return fail("Not your event");
      if (await checkIn({ event: t.event, ticket: ticketKey })) { setResult({ ok: true, text: `Valid: ticket #${t.ticketId} checked in` }); setText(""); }
      else fail("Check-in was not sent (see the error above)");
    } catch (e: any) { fail(e?.message ?? String(e)); }
  }

  async function scan() {
    setScanning(true); setResult(null);
    let live = true;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).catch((e) => { setResult({ ok: false, text: "Camera unavailable: " + e.message }); setScanning(false); return null; });
    if (!stream) return;
    const end = () => { live = false; stream.getTracks().forEach((t) => t.stop()); setScanning(false); };
    stop.current = end;
    const v = video.current!; v.srcObject = stream; await v.play();
    const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
    while (live) {
      const found = await det.detect(v).catch(() => []);
      if (found[0]?.rawValue) { end(); setText(found[0].rawValue); await verify(found[0].rawValue); return; }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-2xl font-bold">Gate</h2>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste gate code"
        className="w-full rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-sm" />
      <div className="flex flex-wrap gap-3">
        <button className={btn} disabled={busy || !text.trim()} onClick={() => verify(text)}>Verify &amp; check in</button>
        {canScan && <button className={btn} disabled={busy || scanning} onClick={scan}>{scanning ? "Scanning…" : "Scan with camera"}</button>}
      </div>
      {!canScan && <p className="text-zinc-400">Camera scanning isn&apos;t supported in this browser, paste the code.</p>}
      <video ref={video} playsInline muted className={scanning ? "w-full rounded-xl" : "hidden"} />
      {result && (
        <div role="alert" className={`rounded-xl border p-4 text-lg ${result.ok ? "border-emerald-400/40 bg-emerald-500/10" : "border-red-400/50 bg-red-950/40 text-red-200"}`}>
          {result.ok ? "✅ " : ""}{result.text}
        </div>
      )}
    </section>
  );
}
