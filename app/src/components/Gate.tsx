"use client";
import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { codeFromScan, verifyCodeAny } from "@/lib/gate";
import { EXTRA_GATE_ORIGINS } from "@/lib/config";
import { thunk } from "@/lib/sounds";
import { btn, btn2, card, h2, input } from "./ui";

type Props = {
  program: any; pk: PublicKey | null; eventKey: PublicKey | undefined; busy: boolean;
  checkIn: (t: { event: PublicKey; ticket: PublicKey; owner: PublicKey }) => Promise<boolean>;
};

export default function Gate({ program, pk, eventKey, busy, checkIn }: Props) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});

  useEffect(() => { setCanScan("BarcodeDetector" in window); return () => stop.current(); }, []);

  async function verify(code: string) {
    const fail = (t: string) => { thunk(); setResult({ ok: false, text: t }); };
    setResult(null);
    if (!pk) return fail("Connect the organizer wallet first");
    const v = verifyCodeAny(codeFromScan(code), { now: Math.floor(Date.now() / 1000), origins: [window.location.origin, ...EXTRA_GATE_ORIGINS] });
    if (!v.ok) return fail(v.reason);
    try {
      // Re-fetch from chain; never trust page state.
      const ticketKey = new PublicKey(v.ticket);
      const t = await program.account.ticket.fetch(ticketKey);
      if (t.owner.toBase58() !== v.wallet) return fail("Wrong owner now: this wallet no longer holds the ticket");
      if (t.used) return fail("Ticket already used");
      if (!eventKey || !t.event.equals(eventKey)) return fail("This ticket is for another event");
      // The program re-checks the owner (OwnerChanged), so a resale after this read can't use up the buyer's ticket.
      if (await checkIn({ event: t.event, ticket: ticketKey, owner: t.owner })) { setResult({ ok: true, text: `Ticket #${t.ticketId} checked in.` }); setText(""); }
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
    <section className={`${card} space-y-4`}>
      <div>
        <h2 className={h2}>Door check-in</h2>
        <p className="text-base text-zinc-400">Scan or paste a guest&apos;s gate code for the event selected above.</p>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Paste gate code"
        className={`${input} font-mono !text-sm`} />
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={busy || !text.trim()} onClick={() => verify(text)}>Check in</button>
        {canScan && <button className={btn2} disabled={busy || scanning} onClick={scan}>{scanning ? "Scanning…" : "Scan with camera"}</button>}
      </div>
      {!canScan && <p className="text-base text-zinc-500">This browser can&apos;t scan QR codes. Paste the code instead.</p>}
      <video ref={video} playsInline muted className={scanning ? "w-full rounded-lg" : "hidden"} />
      {result && (
        <div role="alert" className={`rounded-lg border p-4 text-base ${result.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-red-400/40 bg-red-950/40 text-red-200"}`}>
          {result.text}
        </div>
      )}
    </section>
  );
}
