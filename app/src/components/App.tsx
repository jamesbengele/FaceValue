"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { useAppWallet } from "@/lib/privyWallet";
import { EventAcc, Row, TicketAcc, eventPda, makeProgram, ticketPda } from "@/lib/program";
import { groupByPrice } from "@/lib/market";
import { simulateThenSend } from "@/lib/tx";
import { NoTokenAccount, UiError, toUiError } from "@/lib/errors";
import { EVENT_ADDRESS, explorerTx } from "@/lib/config";
import GateCode from "./GateCode";
import Gate from "./Gate";
import { encodeName, encodedTooLong, fmtStart, matchesQuery, parseName } from "@/lib/eventMeta";
import { baseToDollarString, dollarsToBase, short, usd } from "@/lib/money";

function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="rounded-xl border border-white/15 px-3 text-xl" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      onClick={() => { document.documentElement.dataset.theme = next; setTheme(next); try { localStorage.setItem("theme", next); } catch {} }}>
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

  const [query, setQuery] = useState("");
  const [fundMsg, setFundMsg] = useState("");
  const [bal, setBal] = useState<{ sol: number; usd: string | null } | "error" | null>(null);
  // Set below once the payment mint is known; load() and getFunds() call it so every refresh path updates the balance.
  const refreshBal = useRef<() => Promise<void>>(async () => {});
  const getFunds = useCallback(async () => {
    if (!pk) return;
    setFundMsg("Requesting test funds...");
    try {
      const r = await fetch("/api/drip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: pk.toBase58() }) });
      const j = await r.json();
      setFundMsg(r.ok ? (j.sol || j.usdc ? "Test funds sent." : "You already have enough test funds.") : j.error ?? "Could not get test funds");
      refreshBal.current();
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
    let evs: Row<EventAcc>[];
    try {
      evs = (await (program.account as any).event.all()) as Row<EventAcc>[];
      const tks = (await (program.account as any).ticket.all()) as Row<TicketAcc>[];
      setEvents(evs); setTickets(tks); setLoadErr(null);
      refreshBal.current();
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
      return;
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

  // Balance: SOL plus the token balance of the open event's payment mint (a missing token account is $0.00).
  const payMint = (selEv ?? hostEv ?? allEvents[0])?.account.mint;
  const payMintStr = payMint?.toBase58();
  refreshBal.current = async () => {
    if (!pk) return;
    try {
      const lamports = await connection.getBalance(pk);
      let usdStr: string | null = null;
      if (payMint) {
        try { usdStr = usd((await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(payMint, pk))).value.amount); }
        catch (e: any) { if (/could not find account|invalid param/i.test(e?.message ?? "")) usdStr = usd(0); else throw e; }
      }
      setBal({ sol: lamports / 1e9, usd: usdStr });
    } catch { setBal("error"); }
  };
  useEffect(() => { setBal(null); refreshBal.current(); }, [pk, payMintStr]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Buys one ticket from a same-price group: the first one still listed at that price, re-read just now,
  // so a ticket someone else bought a moment ago is skipped. max_price = the price the user saw on screen.
  const buyResaleAt = (rows: Row<TicketAcc>[], ev: Row<EventAcc>) => run("Resale ticket bought", async () => {
    const buyer = need();
    const buyerToken = await buyerAta(ev.account.mint);
    const price = rows[0].account.askPrice;
    const fresh = (await (program.account as any).ticket.fetchMultiple(rows.map((r) => r.publicKey))) as (TicketAcc | null)[];
    const i = fresh.findIndex((t) => t && t.listed && !t.used && t.askPrice.eq(price) && !t.owner.equals(buyer));
    if (i < 0) { void load(); throw new Error(`Someone else just bought the ${usd(price)} tickets. The list is refreshing.`); }
    return [await program.methods.buyResale(price).accounts({
      buyer, event: ev.publicKey, ticket: rows[i].publicKey,
      sellerToken: getAssociatedTokenAddressSync(ev.account.mint, fresh[i]!.owner), buyerToken,
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

  const shown = allEvents.filter((e) => matchesQuery(e.account.name, query));
  const eventsView = !selEv ? (
    <section className={`${card} space-y-4`}>
      <h2 className="text-2xl font-bold">Events</h2>
      <input type="search" className={input} placeholder="Search events" aria-label="Search events" value={query} onChange={(e) => setQuery(e.target.value)} />
      {events === null ? (!loadErr && <p>Loading…</p>) : allEvents.length === 0 ? <p className="text-xl">No events yet.</p> : shown.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xl">No events match &quot;{query.trim()}&quot;</p>
          <button className={btn} onClick={() => setQuery("")}>Clear search</button>
        </div>
      ) : shown.map((ev) => (
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
        <div className="inline-block rounded-full border border-white/15 px-3 py-1 text-base">Face value {usd(selEv.account.facePrice)} · Max resale {usd(selEv.account.facePrice)}</div>
        {(() => {
          // Other people's listings, one row per price, cheapest first. Your own listings are under My tickets.
          const groups = groupByPrice(ticketsOf(selEv).filter((t) => t.account.listed && !t.account.used && !(pk && t.account.owner.equals(pk))));
          return groups.length === 0 ? <p className="text-zinc-400">Nothing listed right now.</p> : groups.map((g) => (
            <div key={g.price.toString()} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div>
                <div className="text-xl font-semibold">{usd(g.price)}</div>
                <div className="text-zinc-400">{g.rows.length} available</div>
              </div>
              <button className={btn} disabled={busy} onClick={() => buyResaleAt(g.rows, selEv)}>Buy 1 · {usd(g.price)}</button>
            </div>
          ));
        })()}
      </section>
    </>
  );

  const mine = pk ? tickets.filter((t) => t.account.owner.equals(pk) && byKey(t.account.event.toBase58())) : [];
  const ticketsView = (
    <>
    <section className={`${card} space-y-6`}>
      <h2 className="text-2xl font-bold">My tickets</h2>
      {mine.length === 0 && <p className="text-zinc-400">You don&apos;t own a ticket yet.</p>}
      {allEvents.filter((ev) => mine.some((t) => t.account.event.equals(ev.publicKey))).map((ev) => {
        const ts = mine.filter((t) => t.account.event.equals(ev.publicKey)).sort((a, b) => a.account.ticketId - b.account.ticketId);
        const m = parseName(ev.account.name);
        return (
          <div key={ev.publicKey.toBase58()} className="space-y-4 rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xl font-semibold">{m.name}</div>
                <div className="text-zinc-400">{fmtStart(m.startMs)}</div>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-base">{plural(ts.length, "ticket")}</span>
            </div>
            {ts.map((t, i) => {
        const key = t.publicKey.toBase58();
        return (
          <div key={key} className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
            {ts.length > 1 && <span className="text-lg text-zinc-300">Ticket {i + 1} of {ts.length}</span>}
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
          </div>
        );
      })}
    </section>
    </>
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
          <ThemeToggle />
          {pk ? (
            <>
              <span className="text-base sm:text-lg">Email wallet {short(pk)}</span>
              <span className="text-base text-zinc-400 sm:text-lg">
                {bal === "error" ? "Balance unavailable" : bal ? `SOL ${bal.sol.toFixed(4)}${bal.usd ? ` · ${bal.usd}` : ""}` : "…"}
              </span>
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
              <button key={v} aria-current={view === v ? "page" : undefined} className={`m-1 min-h-[48px] flex-1 rounded-xl px-2 text-base md:m-0 md:flex-none md:px-4 md:py-3 md:text-left md:text-lg ${view === v ? "grad font-bold text-black shadow-lg ring-2 ring-pink-400/70" : "border border-white/10 text-zinc-400 md:text-inherit md:hover:bg-white/[0.06]"}`}
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
