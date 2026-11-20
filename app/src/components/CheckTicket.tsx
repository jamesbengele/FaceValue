"use client";
// Opened by scanning a gate QR with any phone camera (the QR is a link: /check#<code>).
// Anyone sees whether the ticket is valid right now; the event's organizer can also check it in.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { codeFromScan, verifyCodeAny } from "@/lib/gate";
import { EXTRA_GATE_ORIGINS } from "@/lib/config";
import { fanPda, makeProgram } from "@/lib/program";
import { parseName } from "@/lib/eventMeta";
import { useAppWallet } from "@/lib/privyWallet";
import { simulateThenSend } from "@/lib/tx";
import { toUiError } from "@/lib/errors";
import { short } from "@/lib/money";
import { btn, btn2, card } from "./ui";

type Verdict =
  | { state: "checking" }
  | { state: "none" }
  | { state: "bad"; title: string; why: string; event?: string; ticketId?: number }
  | { state: "ok"; event: string; ticketId: number; holder: string; eventKey: PublicKey; ticketKey: PublicKey; owner: PublicKey; organizer: PublicKey; validUntil: number };

export default function CheckTicket() {
  const { connection } = useConnection();
  const program = useMemo(() => makeProgram(connection), [connection]);
  const wallet = useAppWallet();
  const pk = wallet.publicKey;
  const [verdict, setVerdict] = useState<Verdict>({ state: "checking" });
  const [scannedAt, setScannedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [err, setErr] = useState("");

  const check = useCallback(async () => {
    const code = codeFromScan(window.location.hash.slice(1));
    setCheckedIn(false); setErr("");
    if (!code) return setVerdict({ state: "none" });
    setVerdict({ state: "checking" });
    setScannedAt(new Date().toLocaleTimeString());
    const v = verifyCodeAny(code, { now: Math.floor(Date.now() / 1000), origins: [window.location.origin, ...EXTRA_GATE_ORIGINS] });
    if (!v.ok) {
      const expired = /expired/i.test(v.reason);
      return setVerdict({ state: "bad", title: expired ? "Code expired" : "Not a valid code",
        why: expired ? "Gate codes change every 10 seconds, so a screenshot or forwarded code stops working. Ask the holder to show the live code." : v.reason });
    }
    try {
      const ticketKey = new PublicKey(v.ticket);
      const t: any = await (program.account as any).ticket.fetch(ticketKey); // read from chain, never from the code
      const e: any = await (program.account as any).event.fetch(t.event);
      const event = parseName(e.name).name;
      if (t.used) return setVerdict({ state: "bad", title: "Already used", why: "This ticket was already checked in. One ticket, one entry.", event, ticketId: t.ticketId });
      if (t.owner.toBase58() !== v.wallet) return setVerdict({ state: "bad", title: "Not the owner", why: "This ticket was resold or sent to someone else, so this code no longer counts.", event, ticketId: t.ticketId });
      setVerdict({ state: "ok", event, ticketId: t.ticketId, holder: v.wallet, eventKey: t.event, ticketKey, owner: t.owner, organizer: e.organizer, validUntil: v.validUntil });
    } catch (x: any) {
      setVerdict({ state: "bad", title: "Ticket not found", why: x?.message?.includes("Account does not exist") ? "No such ticket on chain." : (x?.message ?? String(x)) });
    }
  }, [program]);

  useEffect(() => {
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [check]);

  async function checkIn() {
    if (verdict.state !== "ok" || !pk) return;
    if (Math.floor(Date.now() / 1000) >= verdict.validUntil) return; // the code ran out while this page was open
    setBusy(true); setErr("");
    try {
      const ix = await program.methods.checkIn(verdict.owner).accounts({
        organizer: pk, event: verdict.eventKey, ticket: verdict.ticketKey, fanPass: fanPda(pk, verdict.owner), systemProgram: SystemProgram.programId,
      }).instruction();
      await simulateThenSend(connection, wallet, [ix]);
      setCheckedIn(true);
    } catch (x) { const u = toUiError(x); setErr(u.msg); }
    finally { setBusy(false); }
  }

  const isOrganizer = verdict.state === "ok" && !!pk && pk.equals(verdict.organizer);
  // Tick while a valid code is on screen; when it runs out the verdict turns red on its own.
  useEffect(() => {
    if (verdict.state !== "ok" || checkedIn) return;
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 250);
    return () => clearInterval(id);
  }, [verdict.state, checkedIn]);
  const left = verdict.state === "ok" ? verdict.validUntil - now : 0;
  useEffect(() => {
    if (verdict.state === "ok" && !checkedIn && !busy && left <= 0)
      setVerdict({ state: "bad", title: "Code expired", event: verdict.event, ticketId: verdict.ticketId,
        why: "Gate codes change every 10 seconds, so a screenshot or forwarded code stops working. Ask the holder to show the live code." });
  }, [left, verdict, checkedIn, busy]);

  const good = verdict.state === "ok";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-6">
      <a href="/" className="text-lg font-bold">FaceValue</a>
      {verdict.state === "checking" && <section className={card}><p className="text-lg text-zinc-400">Checking ticket…</p></section>}
      {verdict.state === "none" && (
        <section className={card}><p className="text-lg">Scan a ticket&apos;s gate code to check it.</p></section>
      )}
      {(verdict.state === "ok" || verdict.state === "bad") && (
        <section role="status" className={`rounded-2xl border p-6 ${good ? "border-emerald-400/50 bg-emerald-500/15" : "border-red-400/50 bg-red-500/15"}`}>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-4xl font-bold text-black ${good ? "bg-emerald-400" : "bg-red-400"}`} aria-hidden>
            {good ? "✓" : "✕"}
          </div>
          <h1 className={`mt-4 text-4xl font-extrabold ${good ? "text-emerald-300" : "text-red-300"}`}>
            {checkedIn ? "Checked in" : good ? "Valid ticket" : verdict.title}
          </h1>
          {verdict.state === "ok" ? (
            <dl className="mt-4 space-y-1 text-lg">
              <div><dt className="inline text-zinc-400">Event: </dt><dd className="inline font-semibold">{verdict.event}</dd></div>
              <div><dt className="inline text-zinc-400">Ticket: </dt><dd className="inline font-semibold">#{verdict.ticketId}</dd></div>
              <div><dt className="inline text-zinc-400">Holder: </dt><dd className="inline font-mono">{short(new PublicKey(verdict.holder))}</dd></div>
            </dl>
          ) : (
            <>
              {verdict.event && <p className="mt-3 text-lg"><span className="text-zinc-400">Event: </span><b>{verdict.event}</b>{verdict.ticketId !== undefined && <> · #{verdict.ticketId}</>}</p>}
              <p className="mt-3 text-lg text-zinc-200">{verdict.why}</p>
            </>
          )}
          {good && !checkedIn && <p className="mt-4 text-lg font-semibold tabular-nums text-emerald-200">Code expires in {Math.max(0, left)}s</p>}
          <p className="mt-4 text-sm text-zinc-400">Checked live on Solana at {scannedAt}</p>
        </section>
      )}
      {good && !checkedIn && (
        isOrganizer
          ? <button className={`${btn} py-4 text-lg`} disabled={busy} onClick={checkIn}>{busy ? "Checking in…" : "Check in this ticket"}</button>
          : <p className="text-base text-zinc-400">Door staff: sign in as the event&apos;s organizer on the <a href="/" className="underline">home page</a> to check tickets in.</p>
      )}
      {checkedIn && <p className="text-lg text-emerald-300">Entry recorded on chain. Scanning this code again will now show “Already used”.</p>}
      {err && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-base text-red-200">{err}</p>}
      {(verdict.state === "ok" || verdict.state === "bad") && <button className={btn2} onClick={check}>Check again</button>}
    </main>
  );
}
