"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { useAppWallet } from "@/lib/privyWallet";
import { EventAcc, Row, TicketAcc, eventPda, makeProgram, ticketPda } from "@/lib/program";
import { simulateThenSend } from "@/lib/tx";
import { NoTokenAccount, UiError, toUiError } from "@/lib/errors";
import { EVENT_ADDRESS, explorerTx } from "@/lib/config";
import GateCode from "./GateCode";
import Gate from "./Gate";
import { encodeName, encodedTooLong, fmtStart, parseName } from "@/lib/eventMeta";
import { baseToDollarString, dollarsToBase, short, usd } from "@/lib/money";

const btn = "grad rounded-xl px-5 py-3 text-lg font-semibold text-black disabled:opacity-40 disabled:cursor-not-allowed";
const card = "rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6";
const input = "rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-lg w-full";

function Pill({ t }: { t: TicketAcc }) {
  const [label, cls] = t.used ? ["Used", "bg-zinc-600/40 text-zinc-300"] : t.listed ? ["Listed", "bg-amber-400/20 text-amber-300"] : ["Owned", "bg-violet-500/25 text-violet-200"];
  return <span className={`rounded-full px-3 py-1 text-base ${cls}`}>{label}</span>;
}

function ErrorBox({ e, face }: { e: UiError; face?: string }) {
  if (e.kind === "face")
    return (
      <div role="alert" className="rounded-2xl border-2 border-red-500 bg-red-500/15 p-5 text-lg">
        🚫 <b>Blocked by the ticket itself.</b> Resale price can&apos;t exceed face value ({face ?? "face value"}). This rule is enforced onchain. No one can override it.
      </div>
    );
  return (
    <div role="alert" className="whitespace-pre-wrap rounded-2xl border border-red-400/50 bg-red-950/40 p-4 text-base text-red-200">
      {e.kind === "fv" ? `${e.name}: ${e.msg}` : e.msg}
    </div>
  );
}

function EventHead({ ev, big }: { ev: Row<EventAcc>; big?: boolean }) {
  const m = parseName(ev.account.name);
  return (
    <div>
      <div className={big ? "text-2xl font-bold" : "text-xl font-semibold"}>{m.name}</div>
      <div className="text-zinc-300">{fmtStart(m.startMs)}</div>
      <div className="text-zinc-400">Face price {usd(ev.account.facePrice)} · {ev.account.sold} of {ev.account.maxSupply} sold</div>
    </div>
  );
}

const LABELS = { name: "Name", start: "Date and time", face: "Face price ($)", royalty: "Royalty (%)", supply: "Max supply", mint: "Payment token mint address" };
type View = "events" | "tickets" | "host";
const NAV: [View, string][] = [["events", "Events"], ["tickets", "My tickets"], ["host", "Host an event"]];

export default function App() {
  const { connection } = useConnection();
  const wallet = useAppWallet();
  const pk = wallet.publicKey;
  const program = useMemo(() => makeProgram(connection), [connection]);

  const [view, setView] = useState<View>("events");
  const [sel, setSel] = useState(EVENT_ADDRESS); // event open in Events ("" = the list)
  const [hostSel, setHostSel] = useState(""); // event open in Host ("" = newest of mine)
  const [events, setEvents] = useState<Row<EventAcc>[] | null>(null);
  const [tickets, setTickets] = useState<Row<TicketAcc>[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<UiError | null>(null);
  const [errFace, setErrFace] = useState<string | undefined>();
  const [toast, setToast] = useState<{ sig: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "UBC Student Section", start: "", face: "50", royalty: "5", supply: "20", mint: "" });

  const [fundMsg, setFundMsg] = useState("");
  const getFunds = useCallback(async () => {
    if (!pk) return;
    setFundMsg("Requesting test funds...");
    try {
      const r = await fetch("/api/drip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: pk.toBase58() }) });
      const j = await r.json();
      setFundMsg(r.ok ? (j.sol || j.usdc ? "Test funds sent." : "You already have enough test funds.") : j.error ?? "Could not get test funds");
    } catch (e: any) { setFundMsg(e?.message ?? "Could not get test funds"); }
  }, [pk]);
  // Email wallets start empty: fund once per address right after sign-in.
  const funded = useRef("");
  useEffect(() => {
    if (pk && funded.current !== pk.toBase58()) { funded.current = pk.toBase58(); getFunds(); }
  }, [pk, getFunds]);

  // `?event=<address>` opens one event; `?organizer=1` opens Host an event.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("organizer") === "1") setView("host");
    if (q.get("event")) setSel(q.get("event")!);
  }, []);

  const load = useCallback(async () => {
    try {
      const evs = (await (program.account as any).event.all()) as Row<EventAcc>[];
      const tks = (await (program.account as any).ticket.all()) as Row<TicketAcc>[];
      setEvents(evs); setTickets(tks); setLoadErr(null);
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
    }
  }, [program]);
  // Poll so other windows see new events, listings and sales without a reload.
  useEffect(() => { if (!pk) return; load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load, pk]);

  // Soonest dated event first; undated ones last, newest first.
  const allEvents = useMemo(() => [...(events ?? [])].sort((a, b) => {
    const sa = parseName(a.account.name).startMs, sb = parseName(b.account.name).startMs;
    return sa !== null && sb !== null ? sa - sb : sa !== null ? -1 : sb !== null ? 1 : b.account.eventId.cmp(a.account.eventId);
  }), [events]);
  const byKey = (k: string) => events?.find((e) => e.publicKey.toBase58() === k);
  const myEvents = useMemo(() => (pk ? allEvents.filter((e) => e.account.organizer.equals(pk)) : []), [allEvents, pk]);
  const ticketsOf = (e: Row<EventAcc>) =>
    tickets.filter((t) => t.account.event.equals(e.publicKey)).sort((a, b) => a.account.ticketId - b.account.ticketId);

  const selEv = byKey(sel);
  const hostEv = myEvents.find((e) => e.publicKey.toBase58() === hostSel) ?? myEvents[0];

  // Every action: build instructions, simulate, and only then ask the wallet to sign.
  async function run(text: string, build: () => Promise<TransactionInstruction[]>, ev?: Row<EventAcc>): Promise<boolean> {
    setBusy(true); setErr(null); setToast(null); setErrFace(ev && usd(ev.account.facePrice));
    try {
      const sig = await simulateThenSend(connection, wallet, await build());
      setToast({ sig, text });
      await load();
      return true;
    } catch (e) {
      setErr(toUiError(e));
      return false;
    } finally { setBusy(false); }
  }

  async function buyerAta(mint: PublicKey) {
    const ata = getAssociatedTokenAddressSync(mint, pk!);
    if (!(await connection.getAccountInfo(ata))) throw new NoTokenAccount();
    return ata;
  }
  const need = () => { if (!pk) throw new Error("Connect your wallet first"); return pk; };

  const buyTicket = (ev: Row<EventAcc>) => run("Ticket bought", async () => {
    const buyer = need(); const e = ev.publicKey;
    const buyerToken = await buyerAta(ev.account.mint);
    const fresh: any = await (program.account as any).event.fetch(e);
    return [await program.methods.buyTicket().accounts({
      buyer, event: e, ticket: ticketPda(e, fresh.sold), buyerToken, treasury: ev.account.treasury,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
    }).instruction()];
  }, ev);

  const list = (t: Row<TicketAcc>, ev: Row<EventAcc>) => run("Ticket listed", async () => {
    const base = dollarsToBase(prices[t.publicKey.toBase58()] ?? baseToDollarString(Number(ev.account.facePrice)));
    if (base === null) throw new Error("Enter a price as a number");
    return [await program.methods.listTicket(new BN(base)).accounts({ owner: need(), event: ev.publicKey, ticket: t.publicKey }).instruction()];
  }, ev);

  const cancel = (t: Row<TicketAcc>) => run("Listing cancelled", async () =>
    [await program.methods.cancelListing().accounts({ owner: need(), ticket: t.publicKey }).instruction()]);

  // max_price = the ask the user saw on screen.
  const buyResale = (t: Row<TicketAcc>, ev: Row<EventAcc>) => run("Resale ticket bought", async () => {
    const buyer = need();
    const buyerToken = await buyerAta(ev.account.mint);
    return [await program.methods.buyResale(t.account.askPrice).accounts({
      buyer, event: ev.publicKey, ticket: t.publicKey,
      sellerToken: getAssociatedTokenAddressSync(ev.account.mint, t.account.owner), buyerToken,
      treasury: ev.account.treasury, tokenProgram: TOKEN_PROGRAM_ID,
    }).instruction()];
  }, ev);

  const checkIn = (t: Row<TicketAcc>, ev: Row<EventAcc>) => run("Checked in", async () =>
    [await program.methods.checkIn().accounts({ organizer: need(), event: ev.publicKey, ticket: t.publicKey }).instruction()]);

  const createEvent = () => run("Event created", async () => {
    const organizer = need();
    const mint = new PublicKey(form.mint.trim());
    const faceBase = dollarsToBase(form.face);
    if (faceBase === null) throw new Error("Enter the face price as a number");
    const bps = Math.round(Number(form.royalty) * 100), supply = Number(form.supply);
    if (!Number.isInteger(bps) || !Number.isInteger(supply)) throw new Error("Royalty and supply must be numbers");
    const startMs = form.start ? new Date(form.start).getTime() : null;
    if (startMs !== null && !Number.isFinite(startMs)) throw new Error("Pick a valid date and time");
    if (encodedTooLong(form.name, startMs)) throw new Error("Name too long: with a date the name can be about 25 characters");
    const treasury = getAssociatedTokenAddressSync(mint, organizer);
    const eventId = new BN(Date.now());
    return [
      createAssociatedTokenAccountIdempotentInstruction(organizer, treasury, organizer, mint),
      await program.methods.createEvent(eventId, encodeName(form.name, startMs), new BN(faceBase), bps, supply)
        .accounts({ organizer, event: eventPda(organizer, eventId), mint, treasury, systemProgram: SystemProgram.programId }).instruction(),
    ];
  });

  const eventsView = !selEv ? (
    <section className={`${card} space-y-4`}>
      <h2 className="text-2xl font-bold">Events</h2>
      {events === null ? (!loadErr && <p>Loading…</p>) : allEvents.length === 0 ? <p className="text-xl">No events yet.</p> : allEvents.map((ev) => (
        <button key={ev.publicKey.toBase58()} className="block w-full rounded-xl border border-white/10 p-4 text-left hover:bg-white/[0.06]" onClick={() => setSel(ev.publicKey.toBase58())}>
          <EventHead ev={ev} />
        </button>
      ))}
    </section>
  ) : (
    <>
      <section className={`${card} space-y-3`}>
        <button className="text-zinc-400 underline" onClick={() => setSel("")}>← All events</button>
        <EventHead ev={selEv} big />
        <button className={btn} disabled={busy} onClick={() => buyTicket(selEv)}>Buy ticket · {usd(selEv.account.facePrice)}</button>
      </section>
      <section className={`${card} space-y-4`}>
        <h2 className="text-2xl font-bold">Resale market</h2>
        {(() => {
          const market = ticketsOf(selEv).filter((t) => t.account.listed && !t.account.used);
          return market.length === 0 ? <p className="text-zinc-400">Nothing listed right now.</p> : market.map((t) => (
            <div key={t.publicKey.toBase58()} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Ticket #{t.account.ticketId} · {usd(t.account.askPrice)}</div>
                <div className="text-zinc-400">Seller {short(t.account.owner)}</div>
                <div className="mt-1 inline-block rounded-full border border-white/15 px-3 py-1 text-base">Face value {usd(selEv.account.facePrice)} · Max resale {usd(selEv.account.facePrice)}</div>
              </div>
              <button className={btn} disabled={busy} onClick={() => buyResale(t, selEv)}>Buy · {usd(t.account.askPrice)}</button>
            </div>
          ));
        })()}
      </section>
    </>
  );

  const mine = pk ? tickets.filter((t) => t.account.owner.equals(pk) && byKey(t.account.event.toBase58())) : [];
  const ticketsView = (
    <section className={`${card} space-y-6`}>
      <h2 className="text-2xl font-bold">My tickets</h2>
      {mine.length === 0 && <p className="text-zinc-400">You don&apos;t own a ticket yet.</p>}
      {mine.map((t) => {
        const key = t.publicKey.toBase58(), ev = byKey(t.account.event.toBase58())!, m = parseName(ev.account.name);
        return (
          <div key={key} className="flex flex-wrap items-center gap-3">
            <div className="w-full text-zinc-300">{m.name} · {fmtStart(m.startMs)}</div>
            <span className="text-xl font-semibold">Ticket #{t.account.ticketId}</span>
            <Pill t={t.account} />
            {t.account.listed && <span className="text-lg">asking {usd(t.account.askPrice)}</span>}
            {!t.account.used && <GateCode ticket={key} wallet={wallet} />}
            {!t.account.used && (
              <div className="flex w-full flex-wrap items-center gap-3">
                {!t.account.listed && (
                  <>
                    <span className="text-xl">$</span>
                    <input className={`${input} !w-32`} inputMode="decimal" value={prices[key] ?? baseToDollarString(Number(ev.account.facePrice))}
                      onChange={(e) => setPrices({ ...prices, [key]: e.target.value })} />
                    <button className={btn} disabled={busy} onClick={() => list(t, ev)}>List for resale</button>
                  </>
                )}
                {t.account.listed && <button className={btn} disabled={busy} onClick={() => cancel(t)}>Cancel listing</button>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );

  const hostView = (
    <>
      <section className={`${card} space-y-4`}>
        <h2 className="text-2xl font-bold">Create event</h2>
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
          <label key={k} className="block">
            <span className="text-zinc-400">{LABELS[k]}</span>
            <input className={input} type={k === "start" ? "datetime-local" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <p className="text-zinc-400">Your token account for this mint is created if needed and used as the treasury. Leave the date empty for &ldquo;to be announced&rdquo;.</p>
        <button className={btn} disabled={busy} onClick={createEvent}>Create event</button>
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className="text-2xl font-bold">Your events</h2>
        {myEvents.length === 0 && <p className="text-zinc-400">No event yet</p>}
        {myEvents.map((ev) => (
          <button key={ev.publicKey.toBase58()} className={`block w-full rounded-xl border p-4 text-left ${ev === hostEv ? "border-violet-400" : "border-white/10"}`} onClick={() => setHostSel(ev.publicKey.toBase58())}>
            <EventHead ev={ev} />
          </button>
        ))}
        {hostEv && <p className="break-all text-base text-zinc-400">Link for buyers: <code>?event={hostEv.publicKey.toBase58()}</code></p>}
      </section>
      {hostEv && (
        <section className={`${card} space-y-3`}>
          <h2 className="text-2xl font-bold">Tickets · {parseName(hostEv.account.name).name}</h2>
          {ticketsOf(hostEv).length === 0 && <p className="text-zinc-400">No tickets sold yet.</p>}
          {ticketsOf(hostEv).map((t) => (
            <div key={t.publicKey.toBase58()} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xl">Ticket #{t.account.ticketId} · {short(t.account.owner)}</span>
              <Pill t={t.account} />
              {!t.account.used && !t.account.listed && <button className={btn} disabled={busy} onClick={() => checkIn(t, hostEv)}>Check in</button>}
            </div>
          ))}
        </section>
      )}
      <Gate program={program} pk={pk} eventKey={hostEv?.publicKey} busy={busy} checkIn={(t) => run("Checked in", async () => [await program.methods.checkIn().accounts({ organizer: need(), event: t.event, ticket: t.ticket }).instruction()])} />
    </>
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-6 sm:px-5 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="grad-text text-3xl font-extrabold sm:text-4xl">FaceValue</h1>
        <div className="flex flex-wrap items-center gap-3">
          {pk ? (
            <>
              <span className="text-base sm:text-lg">Email wallet {short(pk)}</span>
              <button className={btn} onClick={() => wallet.emailAuth?.logout()}>Sign out</button>
              <button className={btn} onClick={getFunds}>Get test funds</button>
            </>
          ) : (
            <button className={btn} disabled={!wallet.emailAuth?.ready} onClick={() => wallet.emailAuth?.login()}>Sign in with email</button>
          )}
        </div>
      </header>
      {fundMsg && <p className="text-zinc-300">{fundMsg}</p>}

      {err && <ErrorBox e={err} face={errFace} />}
      {toast && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-lg">
          ✅ {toast.text}. <a className="underline" href={explorerTx(toast.sig)} target="_blank" rel="noreferrer">View on Solana Explorer</a>
        </div>
      )}
      {!pk ? (
        <section className={card}>
          <h2 className="text-2xl font-bold">Sign in to see events</h2>
          <p className="mt-2 text-zinc-400">Sign in with your email to view and buy tickets.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Phone: fixed bottom tab bar. md and up: left sidebar. */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-white/10 bg-[#0b0a12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:w-52 md:shrink-0 md:flex-col md:gap-2 md:border-0 md:bg-transparent md:pb-0">
            {NAV.map(([v, label]) => (
              <button key={v} aria-current={view === v} className={`min-h-[56px] flex-1 px-2 text-base md:flex-none md:rounded-xl md:px-4 md:py-3 md:text-left md:text-lg ${view === v ? "font-semibold text-pink-300 md:grad md:text-black" : "text-zinc-400 md:border md:border-white/10 md:text-inherit md:hover:bg-white/[0.06]"}`}
                onClick={() => { setView(v); if (v === "events") setSel(""); window.scrollTo(0, 0); }}>{label}</button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 space-y-6">
            {loadErr && <ErrorBox e={{ kind: "other", msg: "Could not load onchain data: " + loadErr }} />}
            {view === "events" ? eventsView : view === "tickets" ? ticketsView : hostView}
          </div>
        </div>
      )}
    </main>
  );
}
