"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { SystemProgram, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { useAppWallet } from "@/lib/privyWallet";
import { EventAcc, EventInfoAcc, FanPassAcc, PerksAcc, Row, TicketAcc, discountPda, eventPda, fanPda, infoPda, makeProgram, perksPda, programId, ticketPda } from "@/lib/program";
import { groupByPrice } from "@/lib/market";
import { simulateThenSend } from "@/lib/tx";
import { NoTokenAccount, SimError, UiError, toUiError } from "@/lib/errors";
import { DEMO_MINT, EVENT_ADDRESS, explorerTx } from "@/lib/config";
import GateCode from "./GateCode";
import { Icon, btn, btn2, card, h2, input, rows } from "./ui";
import Gate from "./Gate";
import Landing from "./Landing";
import { SavedAccount, useSavedAccounts } from "@/lib/savedAccounts";
import { normalizeUsername, usernameError, usernameMessage } from "@/lib/usernames";
import { encodeName, encodedTooLong, fmtStart, matchesQuery, parseName } from "@/lib/eventMeta";
import { baseToDollarString, dollarsToBase, short, usd } from "@/lib/money";

function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "dark"), []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className="rounded-lg p-2.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-inherit" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      onClick={() => { document.documentElement.dataset.theme = next; setTheme(next); try { localStorage.setItem("theme", next); } catch {} }}>
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

type Bal = { sol: number; usd: string | null } | "error" | null;
const balText = (bal: Bal) => (bal === "error" ? "Balance unavailable" : bal ? `${bal.usd ? `${bal.usd} · ` : ""}${bal.sol.toFixed(3)} SOL` : "…");

type MenuProps = {
  pk: PublicKey; bal: Bal; email: string | null; username?: string; others: SavedAccount[];
  onFunds: () => void; onSignOut: () => void; onSwitch: (email?: string) => void; onForget: (address: string) => void;
};
function AccountMenu({ pk, bal, email, username, others, onFunds, onSignOut, onSwitch, onForget }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = "block w-full rounded-lg px-3 py-2.5 text-left text-base hover:bg-white/[0.06]";
  return (
    <div ref={ref} className="relative">
      <button className={`${btn2} flex items-center justify-center !px-2.5`} aria-label="Settings and accounts" title="Settings" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <Icon name="settings" className={`h-6 w-6 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="surface absolute right-0 z-30 mt-2 w-72 rounded-xl border border-white/10 p-2 shadow-xl">
          <div className="space-y-1 px-3 py-2">
            <div className="text-sm text-zinc-400">Signed in{username ? <> as <b className="text-inherit">@{username}</b></> : ""}</div>
            {email && <div className="truncate text-base">{email}</div>}
            <div className="break-all font-mono text-sm text-zinc-400">{pk.toBase58()}</div>
            <div className="pt-1 text-base tabular-nums">{balText(bal)}</div>
          </div>
          <div className="my-1 border-t border-white/10" />
          <button role="menuitem" className={item} onClick={() => { onFunds(); setOpen(false); }}>Get test funds</button>
          <div className="my-1 border-t border-white/10" />
          <div className="px-3 pb-1 pt-2 text-sm text-zinc-400">Accounts on this device</div>
          {others.map((a) => (
            <div key={a.address} className="flex items-center gap-1">
              <button role="menuitem" className={`${item} min-w-0 flex-1`} onClick={() => { setOpen(false); onSwitch(a.email); }} title={`Switch to ${a.email}`}>
                <span className="block truncate">{a.username ? `@${a.username}` : a.email}</span>
                {a.username && <span className="block truncate text-sm text-zinc-400">{a.email}</span>}
              </button>
              <button className="rounded-lg px-3 py-2 text-zinc-400 hover:bg-white/[0.06]" aria-label={`Forget ${a.email} on this device`} title="Forget on this device" onClick={() => onForget(a.address)}>×</button>
            </div>
          ))}
          <button role="menuitem" className={item} onClick={() => { setOpen(false); onSwitch(); }}>+ Add another account</button>
          <div className="my-1 border-t border-white/10" />
          <button role="menuitem" className={item} onClick={onSignOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function Status({ t }: { t: TicketAcc }) {
  const [label, dot] = t.used ? ["Used", "bg-zinc-500"] : t.listed ? ["Listed", "bg-amber-400"] : ["Owned", "bg-emerald-400"];
  return <span className="inline-flex items-center gap-2 text-base text-zinc-400"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</span>;
}

// Host's view of one event: progress, three headline numbers, then who holds each ticket.
const wholeDollars = (s: string) => s.replace(/\.00$/, "");
// A steady color per username, so the same person always gets the same avatar.
const avatarStyle = (name: string) => {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return name ? { background: `hsl(${h} 70% 55% / 0.2)`, color: `hsl(${h} 65% 50%)` } : { background: "rgba(127,127,127,0.18)", color: "rgb(127,127,127)" };
};
function SalesPanel({ ev, tickets, busy, whoIs, onCheckIn }: {
  ev: Row<EventAcc>; tickets: Row<TicketAcc>[]; busy: boolean;
  whoIs: (a: PublicKey) => string | undefined; onCheckIn: (t: Row<TicketAcc>) => void;
}) {
  const n = ev.account.sold, max = ev.account.maxSupply;
  const pct = max ? Math.round((n / max) * 100) : 0;
  const checkedIn = tickets.filter((t) => t.account.used).length;
  const onResale = tickets.filter((t) => t.account.listed && !t.account.used).length;
  // Who still needs to come in first, then resale listings, then people already inside.
  const rank = (t: Row<TicketAcc>) => (t.account.used ? 2 : t.account.listed ? 1 : 0);
  const sorted = [...tickets].sort((a, b) => rank(a) - rank(b) || a.account.ticketId - b.account.ticketId);
  const stats: [string, string][] = [[wholeDollars(usd(ev.account.facePrice.muln(n))), "Revenue"], [`${checkedIn}`, "Checked in"], [`${onResale}`, "On resale"]];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-4xl tabular-nums">{n}<span className="text-2xl text-zinc-400"> / {max} sold</span></p>
          <p className="text-base text-zinc-400 tabular-nums">{pct}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tickets sold">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 py-3 text-center">
        {stats.map(([v, l]) => (
          <div key={l} className="min-w-0 px-2">
            <p className="truncate font-display text-2xl tabular-nums sm:text-3xl">{v}</p>
            <p className="whitespace-nowrap text-sm text-zinc-400">{l}</p>
          </div>
        ))}
      </div>
      {sorted.length === 0 ? <p className="text-zinc-400">No tickets sold yet. Share the buyer link to get started.</p> : (
        <ul className={rows}>
          {sorted.map((t) => {
            const name = whoIs(t.account.owner);
            const waiting = !t.account.used && !t.account.listed;
            return (
              <li key={t.publicKey.toBase58()} className="flex items-center gap-3 py-3">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold uppercase" style={avatarStyle(name ?? "")}>{name ? name[0] : "?"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{name ? `@${name}` : "Guest"}</p>
                  <p className="text-sm text-zinc-400">Ticket #{t.account.ticketId}</p>
                </div>
                {waiting
                  ? <button className={`${btn2} !py-2`} disabled={busy} onClick={() => onCheckIn(t)}>Check in</button>
                  : t.account.used
                    ? <span className="whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-sm text-zinc-400">✓ Checked in</span>
                    : <span className="whitespace-nowrap rounded-full bg-amber-400/10 px-3 py-1 text-sm text-amber-300">For resale</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CopyLink({ path }: { path: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try { void navigator.clipboard.writeText(location.origin + path); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return <button className={`${btn2} !py-2`} onClick={copy}>{done ? "Link copied ✓" : "Copy buyer link"}</button>;
}

function ErrorBox({ e, face, title, onClose }: { e: UiError; face?: string; title?: string; onClose?: () => void }) {
  const [head, body, amber] =
    e.kind === "fv" && e.name === "PresaleFansOnly"
      ? ["Fan presale", "Right now only people checked in at this host's past events can buy. It opens to everyone when the presale ends.", true]
      : e.kind === "face"
        ? ["Blocked by the ticket itself", `Resale can't go above face value (${face ?? "face value"}). The program enforces this, so no one can override it.`, false]
        : [title ?? "Not sent", e.msg, false];
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border p-4 ${amber ? "border-amber-400/40 bg-amber-400/10" : "border-red-400/40 bg-red-950/40"}`}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{head}</div>
        <div className="whitespace-pre-wrap text-base text-zinc-300">{body}</div>
      </div>
      {onClose && <button className="-m-1 rounded-md p-1 text-zinc-400 hover:text-inherit" aria-label="Dismiss" onClick={onClose}><Icon name="x" /></button>}
    </div>
  );
}

function PerkTags({ perks }: { perks?: PerksAcc }) {
  if (!perks || (!presaleOpen(perks) && perks.discountBps === 0)) return null;
  return (
    <div className="flex flex-wrap gap-x-4 text-base">
      {presaleOpen(perks) && <span className="text-amber-300">Fan presale until {fmtTime(perks)}</span>}
      {perks.discountBps > 0 && <span className="text-violet-300">{perks.discountBps / 100}% fan discount</span>}
    </div>
  );
}

// One event as a row: name, date and perks on the left; price and sales on the right.
function EventRow({ ev, perks, active, onClick }: { ev: Row<EventAcc>; perks?: PerksAcc; active?: boolean; onClick: () => void }) {
  const m = parseName(ev.account.name);
  return (
    <button className={`-mx-3 flex w-[calc(100%+1.5rem)] items-start justify-between gap-4 rounded-lg px-3 py-3.5 text-left transition hover:bg-white/[0.06] ${active ? "nav-active" : ""}`} onClick={onClick}>
      <div className="min-w-0 space-y-0.5">
        <div className="text-lg font-semibold">{m.name}</div>
        <div className="text-base text-zinc-400">{fmtStart(m.startMs)}</div>
        <PerkTags perks={perks} />
        {soldOut(ev) && <span className="mr-2 inline-block rounded-full bg-rose-500/20 px-3 py-0.5 text-base text-rose-200">Sold out</span>}
        {isPast(ev) && <span className="inline-block rounded-full bg-zinc-500/20 px-3 py-0.5 text-base text-zinc-300">Ended</span>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-semibold tabular-nums">{usd(ev.account.facePrice)}</div>
        <div className="text-base text-zinc-400 tabular-nums">{ev.account.sold} of {ev.account.maxSupply} sold</div>
      </div>
    </button>
  );
}

const soldOut = (ev: Row<EventAcc>) => ev.account.sold >= ev.account.maxSupply;
// An event with no date is never "ended".
const isPast = (ev: Row<EventAcc>) => { const t = parseName(ev.account.name).startMs; return t !== null && t < Date.now(); };
const presaleOpen = (p: PerksAcc) => p.presaleEndsAt.toNumber() * 1000 > Date.now();
const fmtTime = (p: PerksAcc) => new Date(p.presaleEndsAt.toNumber() * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
// Instructions per transaction when listing or cancelling several tickets (keeps it under the size limit).
const MAX_PER_TX = 10;
// My tickets at one event: identical tickets share a row. Owned, then listings by price (cheapest first), then used.
function groupMine(ts: Row<TicketAcc>[]) {
  const owned = ts.filter((t) => !t.account.used && !t.account.listed);
  const used = ts.filter((t) => t.account.used);
  return [
    ...(owned.length ? [{ key: "owned", status: "owned" as const, rows: owned }] : []),
    ...groupByPrice(ts.filter((t) => t.account.listed && !t.account.used)).map((g) => ({ key: `listed:${g.price}`, status: "listed" as const, rows: g.rows })),
    ...(used.length ? [{ key: "used", status: "used" as const, rows: used }] : []),
  ];
}

type FormKey = "name" | "start" | "face" | "royalty" | "supply" | "early" | "discount" | "earlyMin" | "venue" | "description" | "image";
// [key, label, full width on desktop, help text]
const EVENT_FIELDS: [FormKey, string, boolean, string?][] = [
  ["name", "Name", true], ["start", "Date and time", false, "Leave empty for “to be announced”."], ["face", "Face price (USDC)", false],
  ["supply", "Tickets available", false], ["royalty", "Your royalty on resales (%)", false],
  ["venue", "Venue (optional)", true], ["description", "Description (optional)", true], ["image", "Image link, https://… (optional)", true],
];
const PERK_FIELDS: [FormKey, string][] = [["early", "Presale length (minutes)"], ["discount", "Discount on one ticket (%)"], ["earlyMin", "Check-ins needed"]];
type View = "events" | "tickets" | "mine" | "host";
const NAV: [View, string][] = [["events", "Events"], ["tickets", "My tickets"], ["mine", "My events"], ["host", "Host"]];

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
  const [infos, setInfos] = useState<Row<EventInfoAcc>[]>([]);
  // Usernames (off-chain, SPEC §5): address -> name, for event organizers and the signed-in wallet.
  const [names, setNames] = useState<Record<string, string>>({});
  // Remember each account signed in on this device (email, wallet, username) for one-tap switching.
  const saved = useSavedAccounts();
  const myEmail = wallet.emailAuth?.email ?? null;
  const myName = pk ? names[pk.toBase58()] : undefined;
  const { remember } = saved;
  useEffect(() => { if (pk && myEmail) remember({ email: myEmail, address: pk.toBase58(), username: myName }); }, [pk, myEmail, myName, remember]);
  const [namesLoaded, setNamesLoaded] = useState(false);
  const [namesTried, setNamesTried] = useState(false); // first lookup finished (ok or not); if it fails the app is not blocked
  const [nameInput, setNameInput] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [giveTo, setGiveTo] = useState<Record<string, string>>({});
  const [fanPasses, setFanPasses] = useState<Row<FanPassAcc>[]>([]);
  const [perksList, setPerksList] = useState<Row<PerksAcc>[]>([]);
  const [discountUsed, setDiscountUsed] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<UiError | null>(null);
  const [errFace, setErrFace] = useState<string | undefined>();
  const [toast, setToast] = useState<{ sig: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [qtys, setQtys] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "UBC Student Section", start: "", face: "50", royalty: "5", supply: "20", mint: "", early: "0", discount: "0", earlyMin: "1", venue: "", description: "", image: "" });

  const [query, setQuery] = useState("");
  // Per-device hiding of old events; nothing onchain changes (SPEC §5).
  const [qty, setQty] = useState(1);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  useEffect(() => { try { setHidden(JSON.parse(localStorage.getItem("hiddenEvents") || "[]")); } catch {} }, []);
  const hide = (key: string, on: boolean) => setHidden((h) => {
    const n = on ? [...h, key] : h.filter((k) => k !== key);
    try { localStorage.setItem("hiddenEvents", JSON.stringify(n)); } catch {}
    return n;
  });
  const [fundMsg, setFundMsg] = useState("");
  const [bal, setBal] = useState<Bal>(null);
  // Success and test-funds notices fade on their own; errors stay until dismissed or the next action.
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 8000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!fundMsg || fundMsg.endsWith("...")) return; const t = setTimeout(() => setFundMsg(""), 5000); return () => clearTimeout(t); }, [fundMsg]);
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
      // Old-layout accounts from earlier program versions are skipped by size.
      const sized = (t: string, size: number) => (program.account as any)[t].all([{ dataSize: size }]);
      evs = (await sized("event", 167)) as Row<EventAcc>[];
      const tks = (await sized("ticket", 87)) as Row<TicketAcc>[];
      setEvents(evs); setTickets(tks); setLoadErr(null);
      refreshBal.current();
    } catch (e: any) {
      setLoadErr(e?.message ?? String(e));
      return;
    }
    // Loyalty accounts sit at known addresses, so read them directly (lighter on the rate-limited RPC than a scan).
    // None exist until the updated program is deployed, and a failure here must not hide events.
    try {
      const at = async <T,>(type: string, keys: PublicKey[]) => {
        const accs = keys.length ? ((await (program.account as any)[type].fetchMultiple(keys)) as (T | null)[]) : [];
        return accs.flatMap((account, i) => (account ? [{ publicKey: keys[i], account }] : []));
      };
      const orgs = [...new Set(evs.map((e) => e.account.organizer.toBase58()))].map((o) => new PublicKey(o));
      setPerksList(await at<PerksAcc>("perks", evs.map((e) => perksPda(e.publicKey))));
      setInfos(await at<EventInfoAcc>("eventInfo", evs.map((e) => infoPda(e.publicKey))));
      setFanPasses(pk ? await at<FanPassAcc>("fanPass", orgs.map((o) => fanPda(o, pk))) : []);
    } catch { /* keep the last good values */ }
  }, [program, pk]);
  // Poll so other windows see new events, listings and sales without a reload.
  useEffect(() => { if (!pk) return; load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load, pk]);

  // Soonest dated event first; undated ones last, newest first.
  const buyable = (e: Row<EventAcc>) => !DEMO_MINT || e.account.mint.toBase58() === DEMO_MINT;
  const allEvents = useMemo(() => [...(events ?? [])].sort((a, b) => {
    const sa = parseName(a.account.name).startMs, sb = parseName(b.account.name).startMs;
    return sa !== null && sb !== null ? sa - sb : sa !== null ? -1 : sb !== null ? 1 : b.account.eventId.cmp(a.account.eventId);
  }), [events]);
  const byKey = (k: string) => events?.find((e) => e.publicKey.toBase58() === k);
  const myEvents = useMemo(() => (pk ? allEvents.filter((e) => e.account.organizer.equals(pk)) : []), [allEvents, pk]);
  const ticketsOf = (e: Row<EventAcc>) =>
    tickets.filter((t) => t.account.event.equals(e.publicKey)).sort((a, b) => a.account.ticketId - b.account.ticketId);

  // Check-ins the signed-in wallet has with an organizer (its FanPass), and an event's fan perks.
  const attendedWith = (org: PublicKey) =>
    (pk && fanPasses.find((f) => f.account.organizer.equals(org) && f.account.fan.equals(pk))?.account.attended) || 0;
  const perksOf = (e: Row<EventAcc>) => perksList.find((x) => x.account.event.equals(e.publicKey))?.account;

  const selEv = byKey(sel);
  useEffect(() => {
    setDiscountUsed(false);
    if (!pk || !sel) return;
    let k: PublicKey; try { k = discountPda(new PublicKey(sel), pk); } catch { return; }
    connection.getAccountInfo(k).then((a) => setDiscountUsed(!!a && a.owner.equals(programId))).catch(() => {});
  }, [sel, pk, tickets, connection]);
  const hostEv = myEvents.find((e) => e.publicKey.toBase58() === hostSel) ?? myEvents[0];

  // Balance: SOL plus the largest balance among the payment tokens the listed events use (a wallet with none is $0.00).
  // It does not depend on which event is open, so opening an event never changes it.
  const payMints = useMemo(() => [...new Set(allEvents.filter(buyable).map((e) => e.account.mint.toBase58()))].sort(), [allEvents]);
  const payMintsKey = payMints.join(",");
  refreshBal.current = async () => {
    if (!pk) return;
    try {
      const lamports = await connection.getBalance(pk);
      let usdStr: string | null = null;
      if (payMints.length) {
        const accs = await connection.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID });
        const best = accs.value.reduce((m, a) => {
          const info = a.account.data.parsed.info;
          return payMints.includes(info.mint) && BigInt(info.tokenAmount.amount) > m ? BigInt(info.tokenAmount.amount) : m;
        }, BigInt(0));
        usdStr = usd(best);
      }
      setBal({ sol: lamports / 1e9, usd: usdStr });
    } catch { setBal("error"); }
  };
  useEffect(() => { setBal(null); refreshBal.current(); }, [pk, payMintsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const organizersKey = useMemo(() => [...new Set(allEvents.map((e) => e.account.organizer.toBase58()))].sort().join(","), [allEvents]);
  const loadNames = useCallback(async () => {
    const addrs = [...new Set([...organizersKey.split(",").filter(Boolean), ...(pk ? [pk.toBase58()] : [])])];
    if (!addrs.length) return;
    try {
      const r = await fetch(`/api/username?addresses=${addrs.join(",")}`);
      if (r.ok) { const j = await r.json(); setNames((n) => ({ ...n, ...j })); setNamesLoaded(true); }
    } catch { /* names are optional: fall back to short addresses */ }
    setNamesTried(true);
  }, [organizersKey, pk]);
  useEffect(() => { loadNames(); }, [loadNames]);
  const whoIs = (a: PublicKey) => names[a.toBase58()];
  const saveUsername = async () => {
    setNameMsg("");
    const bad = usernameError(nameInput);
    if (bad) { setNameMsg(bad); return; }
    try {
      if (!pk || !wallet.signMessage) throw new Error("This wallet can't sign messages");
      const name = normalizeUsername(nameInput);
      const signature = await wallet.signMessage(new TextEncoder().encode(usernameMessage(name)));
      const r = await fetch("/api/username", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: pk.toBase58(), username: name, signature: Buffer.from(signature).toString("base64") }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save the username");
      setNames((n) => ({ ...n, [pk.toBase58()]: name }));
    } catch (e: any) { setNameMsg(e?.message ?? "Could not save the username"); }
  };

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
    // Each event names its own payment mint, so the header balance (largest across mints) can be money this event can't use.
    const bal = await connection.getTokenAccountBalance(ata).catch(() => null);
    if (!bal || bal.value.amount === "0") throw new NoTokenAccount();
    return ata;
  }
  const need = () => { if (!pk) throw new Error("Connect your wallet first"); return pk; };

  const buyTicket = (ev: Row<EventAcc>, n = 1) => run(n > 1 ? `${n} tickets bought` : "Ticket bought", async () => {
    const buyer = need(); const e = ev.publicKey;
    const buyerToken = await buyerAta(ev.account.mint);
    const fresh: any = await (program.account as any).event.fetch(e);
    // Several tickets go in one transaction, so it is all or nothing; ticket ids follow `sold`.
    return Promise.all(Array.from({ length: n }, (_, i) => program.methods.buyTicket().accounts({
      buyer, event: e, ticket: ticketPda(e, fresh.sold + i), buyerToken, treasury: ev.account.treasury,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      perks: perksPda(e), fanPass: fanPda(ev.account.organizer, buyer), discount: discountPda(e, buyer),
    }).instruction()));
  }, ev);

  // Several identical tickets are listed or cancelled in one transaction (one instruction each).
  const listMany = (rows: Row<TicketAcc>[], ev: Row<EventAcc>, priceKey: string) =>
    run(rows.length > 1 ? `${rows.length} tickets listed` : "Ticket listed", async () => {
      const base = dollarsToBase(prices[priceKey] ?? baseToDollarString(Number(ev.account.facePrice)));
      if (base === null) throw new Error("Enter a price as a number");
      const owner = need();
      return Promise.all(rows.map((t) => program.methods.listTicket(new BN(base)).accounts({ owner, event: ev.publicKey, ticket: t.publicKey }).instruction()));
    }, ev);

  const cancelMany = (rows: Row<TicketAcc>[]) => run(rows.length > 1 ? `${rows.length} listings cancelled` : "Listing cancelled", async () => {
    const owner = need();
    return Promise.all(rows.map((t) => program.methods.cancelListing().accounts({ owner, ticket: t.publicKey }).instruction()));
  });

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

  // `owner` is who the organizer saw holding the ticket; the program rejects the check-in (OwnerChanged) if it was resold since.
  async function checkInIx(event: PublicKey, ticket: PublicKey, owner: PublicKey) {
    const organizer = need();
    return program.methods.checkIn(owner).accounts({
      organizer, event, ticket, fanPass: fanPda(organizer, owner), systemProgram: SystemProgram.programId,
    }).instruction();
  }
  const checkIn = (t: Row<TicketAcc>, ev: Row<EventAcc>) => run("Checked in", async () => [await checkInIx(ev.publicKey, t.publicKey, t.account.owner)]);

  const deleteEvent = (ev: Row<EventAcc>) => {
    if (!window.confirm(`Delete "${parseName(ev.account.name).name}"? This can't be undone.`)) return;
    return run("Event deleted", async () => [await program.methods.closeEvent().accounts({ organizer: need(), event: ev.publicKey }).instruction()]);
  };

  const infoOf = (ev: Row<EventAcc>) => infos.find((i) => i.account.event.equals(ev.publicKey))?.account;

  // Gifting is hidden for the demo (off-platform resale Q&A); the program still supports it. Flip to re-enable.
  const SHOW_GIFTING = false;
  // Gift: the program refuses used or listed tickets; no payment, so there is no price to cap.
  const give = (t: Row<TicketAcc>) => run("Ticket sent", async () => {
    let to: PublicKey;
    try { to = new PublicKey((giveTo[t.publicKey.toBase58()] ?? "").trim()); } catch { throw new Error("Paste your friend's wallet address (they find it at the top of My tickets)"); }
    return [await program.methods.transferTicket().accounts({ owner: need(), ticket: t.publicKey, newOwner: to }).instruction()];
  });

  const createEvent = () => run("Event created", async () => {
    const organizer = need();
    if (!DEMO_MINT) throw new Error("Payments are not configured (NEXT_PUBLIC_DEMO_MINT is unset)");
    const mint = new PublicKey(DEMO_MINT);
    const faceBase = dollarsToBase(form.face);
    if (faceBase === null) throw new Error("Enter the face price as a number");
    const bps = Math.round(Number(form.royalty) * 100), supply = Number(form.supply);
    if (!Number.isInteger(bps) || !Number.isInteger(supply)) throw new Error("Royalty and supply must be numbers");
    const startMs = form.start ? new Date(form.start).getTime() : null;
    if (startMs !== null && !Number.isFinite(startMs)) throw new Error("Pick a valid date and time");
    if (encodedTooLong(form.name, startMs)) throw new Error("Name too long: with a date the name can be about 25 characters");
    const earlyMins = Number(form.early || "0"), earlyMin = Number(form.earlyMin || "0"), discBps = Math.round(Number(form.discount || "0") * 100);
    if (!Number.isFinite(earlyMins) || earlyMins < 0 || !Number.isInteger(earlyMin) || !Number.isInteger(discBps))
      throw new Error("Fan perks: minutes and discount must be numbers, check-ins a whole number");
    const treasury = getAssociatedTokenAddressSync(mint, organizer);
    const eventId = new BN(Date.now());
    const event = eventPda(organizer, eventId);
    const ixs = [
      createAssociatedTokenAccountIdempotentInstruction(organizer, treasury, organizer, mint),
      await program.methods.createEvent(eventId, encodeName(form.name, startMs), new BN(faceBase), bps, supply)
        .accounts({ organizer, event, mint, treasury, systemProgram: SystemProgram.programId }).instruction(),
    ];
    // Same transaction, so the perks are set before anyone can buy. The program checks the limits (InvalidPerks).
    if (earlyMins > 0 || discBps > 0)
      ixs.push(await program.methods.setPerks(new BN(earlyMins > 0 ? Math.floor(Date.now() / 1000 + earlyMins * 60) : 0), earlyMin, discBps)
        .accounts({ organizer, event, perks: perksPda(event), systemProgram: SystemProgram.programId }).instruction());
    // Details are optional; they live in a separate account so events without them keep working.
    if (form.venue || form.description || form.image)
      ixs.push(await program.methods.setEventInfo(new BN(Math.floor((startMs ?? Date.now()) / 1000)), form.venue, form.description, form.image)
        .accounts({ organizer, event, info: infoPda(event), systemProgram: SystemProgram.programId }).instruction());
    return ixs;
  });

  const shown = allEvents.filter((e) => buyable(e) && matchesQuery(e.account.name, query) && (showHidden || !hidden.includes(e.publicKey.toBase58())));
  const eventsView = !selEv ? (
    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={h2}>Events</h2>
        <input type="search" className={`${input} sm:!w-64`} placeholder="Search" aria-label="Search events" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {events === null ? (!loadErr && <p className="text-zinc-400">Loading…</p>) : allEvents.length === 0 ? <p className="text-zinc-400">No events yet.</p> : shown.length === 0 ? (
        <p className="text-zinc-400">No events match &ldquo;{query.trim()}&rdquo;. <button className="underline" onClick={() => setQuery("")}>Clear search</button></p>
      ) : (
        <div className={rows}>
          {shown.map((ev) => {
            const key = ev.publicKey.toBase58(), isHidden = hidden.includes(key);
            return (
              <div key={key} className={isHidden ? "opacity-60" : ""}>
                <EventRow ev={ev} perks={perksOf(ev)} onClick={() => setSel(key)} />
                <button className="mb-2 text-base text-zinc-400 underline" onClick={() => hide(key, isHidden)}>{isHidden ? "Unhide" : "Hide on this device"}</button>
              </div>
            );
          })}
        </div>
      )}
      {hidden.length > 0 && <button className="text-base text-zinc-400 underline" onClick={() => setShowHidden(!showHidden)}>{showHidden ? "Stop showing hidden events" : `Show hidden (${hidden.length})`}</button>}
    </section>
  ) : (
    <>
      <section className={`${card} space-y-5`}>
        <button className="-ml-1 inline-flex items-center gap-1 text-base text-zinc-400 hover:text-inherit" onClick={() => setSel("")}><Icon name="back" className="h-4 w-4" />All events</button>
        {(() => {
          const m = parseName(selEv.account.name);
          const perks = perksOf(selEv), n = attendedWith(selEv.account.organizer);
          const fan = !!perks && n >= perks.minAttended, face = selEv.account.facePrice;
          // Display only: the program computes the price it charges (floor of face * bps / 10_000 off).
          const fanPrice = perks && fan && perks.discountBps > 0 && !discountUsed ? face.sub(face.muln(perks.discountBps).divn(10_000)) : null;
          const presale = perks && presaleOpen(perks);
          return (
            <>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold sm:text-3xl">{m.name}</h2>
                <p className="text-base text-zinc-400">Created by {whoIs(selEv.account.organizer) ? <><span className="font-semibold text-inherit">{whoIs(selEv.account.organizer)}</span> <span className="font-mono text-sm">{short(selEv.account.organizer)}</span></> : <span className="font-mono text-sm">{short(selEv.account.organizer)}</span>}</p>
                <p className="text-zinc-400">{fmtStart(m.startMs)} · {selEv.account.sold} of {selEv.account.maxSupply} sold</p>
                {soldOut(selEv) && <span className="mr-2 inline-block rounded-full bg-rose-500/20 px-3 py-0.5 text-base text-rose-200">Sold out</span>}
                {isPast(selEv) && <span className="inline-block rounded-full bg-zinc-500/20 px-3 py-0.5 text-base text-zinc-300">Ended</span>}
              </div>
              {(() => { const i = infoOf(selEv); return i && (
                <div className="space-y-2">
                  {/^https?:\/\//.test(i.imageUrl) && <img src={i.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />}
                  {i.venue && <div className="text-lg text-zinc-300">{i.venue}</div>}
                  {i.description && <p className="whitespace-pre-line text-zinc-300">{i.description}</p>}
                </div>
              ); })()}
              <button className="text-base text-zinc-400 underline" onClick={() => { try { void navigator.clipboard.writeText(`${location.origin}/?event=${selEv.publicKey.toBase58()}`); } catch {} }}>Copy link to this event</button>
              {perks && (presale || perks.discountBps > 0) ? (
                <div className="space-y-2 rounded-lg border border-white/10 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">Fan perks</span>
                    <span className="text-base text-zinc-400">Need {plural(perks.minAttended, "check-in")} with this host · you have {n}</span>
                  </div>
                  {presale && <p className="text-base"><span className="text-amber-300">Presale until {fmtTime(perks)}.</span> {fan ? "You can buy now." : "You can buy when it opens to everyone."}</p>}
                  {perks.discountBps > 0 && (
                    <p className="text-base"><span className="text-violet-300">{perks.discountBps / 100}% off one ticket.</span>{" "}
                      {fanPrice ? `Your price is ${usd(fanPrice)}.` : fan ? "Already used for this event." : "Not unlocked yet."}</p>
                  )}
                </div>
              ) : n > 0 ? <p className="text-base text-zinc-400">You&apos;ve checked in at {plural(n, "event")} by this host.</p> : null}
              {!soldOut(selEv) && !isPast(selEv) && (() => {
                const max = Math.min(4, selEv.account.maxSupply - selEv.account.sold), n = Math.min(qty, max);
                return (
                  <label className="flex items-center gap-3 text-lg">Tickets
                    <select className={input} style={{ width: "auto" }} value={n} onChange={(e) => setQty(Number(e.target.value))}>
                      {Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                    <span className="text-zinc-400">Total {usd(face.muln(n))}{fanPrice ? " (discount applies to one ticket)" : ""}</span>
                  </label>
                );
              })()}
              <button className={btn} disabled={busy || soldOut(selEv) || isPast(selEv)} onClick={() => buyTicket(selEv, Math.min(qty, 4, selEv.account.maxSupply - selEv.account.sold))}>
                {soldOut(selEv) ? "Sold out" : isPast(selEv) ? "This event has ended" : fanPrice && qty === 1 ? <>Buy ticket · <s className="opacity-60">{usd(face)}</s> {usd(fanPrice)}</> : qty > 1 ? <>Buy {qty} tickets</> : <>Buy ticket · {usd(face)}</>}
              </button>
            </>
          );
        })()}
      </section>
      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>Resale</h2>
          <span className="text-base text-zinc-400">Capped at face value, {usd(selEv.account.facePrice)}</span>
        </div>
        {(() => {
          // Other people's listings, one row per price, cheapest first. Your own are counted below and managed in My tickets.
          const listed = ticketsOf(selEv).filter((t) => t.account.listed && !t.account.used);
          const minePk = (t: Row<TicketAcc>) => !!pk && t.account.owner.equals(pk);
          const groups = groupByPrice(listed.filter((t) => !minePk(t)));
          const ownCount = listed.filter(minePk).length;
          return (
            <>
              {groups.length === 0 ? <p className="text-zinc-400">No resale tickets right now.</p> : (
                <div className={rows}>
                  {groups.map((g) => (
                    <div key={g.price.toString()} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <div className="text-lg font-semibold tabular-nums">{usd(g.price)}</div>
                        <div className="text-base text-zinc-400">{g.rows.length} available</div>
                      </div>
                      <button className={btn2} disabled={busy} onClick={() => buyResaleAt(g.rows, selEv)}>Buy 1</button>
                    </div>
                  ))}
                </div>
              )}
              {ownCount > 0 && (
                <p className="text-base text-zinc-400">You have {plural(ownCount, "ticket")} listed here. <button className="underline hover:text-inherit" onClick={() => { setView("tickets"); window.scrollTo(0, 0); }}>Manage in My tickets</button></p>
              )}
            </>
          );
        })()}
      </section>
    </>
  );

  const mine = pk ? tickets.filter((t) => t.account.owner.equals(pk) && byKey(t.account.event.toBase58())) : [];
  const myPasses = pk ? fanPasses.filter((f) => f.account.fan.equals(pk)) : [];
  const ticketsView = (
    <>
      <section className={`${card} space-y-5`}>
        <h2 className={h2}>My tickets</h2>
        {pk && SHOW_GIFTING && <p className="break-all text-base text-zinc-400">Your wallet address (give it to friends so they can send you tickets): <code>{pk.toBase58()}</code></p>}
        {mine.length === 0 && <p className="text-zinc-400">No tickets yet.</p>}
        <div className="space-y-6 [&>*+*]:border-t [&>*+*]:border-white/10 [&>*+*]:pt-6">
          {allEvents.filter((ev) => mine.some((t) => t.account.event.equals(ev.publicKey))).sort((a, b) => Number(isPast(a)) - Number(isPast(b)) || (parseName(a.account.name).startMs ?? Infinity) - (parseName(b.account.name).startMs ?? Infinity)).map((ev) => {
            const ts = mine.filter((t) => t.account.event.equals(ev.publicKey)).sort((a, b) => a.account.ticketId - b.account.ticketId);
            const m = parseName(ev.account.name);
            return (
              <div key={ev.publicKey.toBase58()} className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-lg font-semibold">{m.name}{isPast(ev) && <span className="ml-2 rounded-full bg-zinc-500/20 px-3 py-0.5 text-base font-normal text-zinc-300">Ended</span>}</div>
                  <div className="text-base text-zinc-400">{fmtStart(m.startMs)}</div>
                </div>
                <div className={rows}>
                  {groupMine(ts).map((g) => {
                    const n = g.rows.length, gk = `${ev.publicKey.toBase58()}:${g.key}`;
                    const clampQty = (v: string) => Math.min(Math.max(1, Math.floor(Number(v)) || 1), n, MAX_PER_TX);
                    const qty = clampQty(qtys[gk] ?? String(n)); // listing: defaults to all of them
                    const cancelQty = clampQty(qtys[gk] ?? "1"); // cancelling: defaults to one
                    const small = `${input} !w-20 text-center tabular-nums`;
                    return (
                      <div key={g.key} className="space-y-3 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="font-semibold">{plural(n, "ticket")}</span>
                          <Status t={g.rows[0].account} />
                          {g.status === "listed" && <span className="text-base text-zinc-400 tabular-nums">at {usd(g.rows[0].account.askPrice)} each</span>}
                        </div>
                        {g.status === "owned" && (
                          <div className="flex flex-wrap items-center gap-2">
                            {n > 1 && (
                              <>
                                <span className="text-base text-zinc-400">List</span>
                                <input className={small} inputMode="numeric" aria-label="How many to list" value={qtys[gk] ?? String(Math.min(n, MAX_PER_TX))}
                                  onChange={(e) => setQtys({ ...qtys, [gk]: e.target.value })} />
                              </>
                            )}
                            <span className="text-base text-zinc-400">{n > 1 ? "at $" : "Price $"}</span>
                            <input className={`${input} !w-28 tabular-nums`} inputMode="decimal" aria-label="Price each" value={prices[gk] ?? baseToDollarString(Number(ev.account.facePrice))}
                              onChange={(e) => setPrices({ ...prices, [gk]: e.target.value })} />
                            <button className={btn2} disabled={busy} onClick={() => listMany(g.rows.slice(0, qty), ev, gk)}>
                              {n > 1 ? `List ${qty} for resale` : "List for resale"}
                            </button>
                          </div>
                        )}
                        {g.status === "listed" && (
                          // Default 1: cancelling is the step people do one ticket at a time.
                          <div className="flex flex-wrap items-center gap-2">
                            {n > 1 && (
                              <>
                                <span className="text-base text-zinc-400">Cancel</span>
                                <input className={small} inputMode="numeric" aria-label="How many listings to cancel" value={qtys[gk] ?? "1"}
                                  onChange={(e) => setQtys({ ...qtys, [gk]: e.target.value })} />
                                <span className="text-base text-zinc-400">of {n}</span>
                              </>
                            )}
                            <button className={btn2} disabled={busy} onClick={() => cancelMany(g.rows.slice(0, cancelQty))}>
                              {n > 1 ? `Cancel ${plural(cancelQty, "listing")}` : "Cancel listing"}
                            </button>
                          </div>
                        )}
                        {g.status === "owned" && (n === 1 ? <GateCode ticket={g.rows[0].publicKey.toBase58()} wallet={wallet} /> : (
                          // Each ticket needs its own code at the door, so they stay one tap away.
                          <details>
                            <summary className="cursor-pointer text-base text-zinc-400 hover:text-inherit">Gate codes ({n})</summary>
                            <div className="mt-3 space-y-5">
                              {g.rows.map((t, i) => (
                                <div key={t.publicKey.toBase58()} className="space-y-2">
                                  <div className="text-base text-zinc-400">Ticket {i + 1} of {n}</div>
                                  <GateCode ticket={t.publicKey.toBase58()} wallet={wallet} />
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                        {SHOW_GIFTING && g.status === "owned" && (() => { const t = g.rows[0], k = t.publicKey.toBase58(); return (
                          <div className="flex flex-wrap items-center gap-2">
                            <input className={`${input} !w-72 max-w-full`} placeholder="Friend's wallet address" aria-label="Send one ticket to a friend" value={giveTo[k] ?? ""} onChange={(e) => setGiveTo({ ...giveTo, [k]: e.target.value })} />
                            <button className={btn2} disabled={busy || !giveTo[k]} onClick={() => give(t)}>{n > 1 ? "Send 1 to a friend" : "Send to a friend"}</button>
                          </div>
                        ); })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className={`${card} space-y-3`}>
        <h2 className={h2}>Fan record</h2>
        {myPasses.length === 0 ? (
          <p className="text-zinc-400">No check-ins yet. Hosts can reward regulars with a presale or a discount.</p>
        ) : (
          <div className={rows}>
            {myPasses.map((f) => {
              const names = allEvents.filter((e) => e.account.organizer.equals(f.account.organizer)).map((e) => parseName(e.account.name).name);
              return (
                <div key={f.publicKey.toBase58()} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate">Host of {names.slice(0, 2).join(", ") || short(f.account.organizer)}{names.length > 2 ? "…" : ""}</span>
                  <span className="shrink-0 text-zinc-400 tabular-nums">{plural(f.account.attended, "check-in")}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );

  const hostView = (
    <>
      <section className={`${card} space-y-5`}>
        <h2 className={h2}>Create an event</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {EVENT_FIELDS.map(([k, label, wide, help]) => (
            <label key={k} className={`block space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
              <span className="text-base text-zinc-400">{label}</span>
              <input className={input} type={k === "start" ? "datetime-local" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              {help && <span className="block text-sm text-zinc-500">{help}</span>}
            </label>
          ))}
        </div>
        <div className="space-y-3 border-t border-white/10 pt-5">
          <div>
            <div className="font-semibold">Fan perks <span className="font-normal text-zinc-400">(optional)</span></div>
            <p className="text-base text-zinc-400">For people who checked in at your past events. Set 0 to turn one off.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PERK_FIELDS.map(([k, label]) => (
              <label key={k} className="block space-y-1.5">
                <span className="text-base text-zinc-400">{label}</span>
                <input className={`${input} tabular-nums`} inputMode="numeric" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
        <button className={btn} disabled={busy} onClick={createEvent}>Create event</button>
      </section>
    </>
  );

  // Usernames of the selected event's ticket holders, so the host sees names, not wallet codes.
  // Wallets without one are stored as "" so they aren't fetched again on every refresh.
  const holdersKey = hostEv ? [...new Set(ticketsOf(hostEv).map((t) => t.account.owner.toBase58()))].sort().join(",") : "";
  useEffect(() => {
    const want = holdersKey.split(",").filter((a) => a && !(a in names));
    if (!want.length) return;
    fetch(`/api/username?addresses=${want.join(",")}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((j: Record<string, string>) => setNames((n) => ({ ...n, ...Object.fromEntries(want.map((a) => [a, j[a] ?? ""])) })));
  }, [holdersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Events the signed-in wallet organizes: sales, buyer link, delete, tickets, check-in and the gate.
  const myEventsView = (
    <>
      <section className={`${card} space-y-3`}>
        <h2 className={h2}>My events</h2>
        {myEvents.length === 0 ? <p className="text-zinc-400">None yet. <button className="underline hover:text-inherit" onClick={() => { setView("host"); window.scrollTo(0, 0); }}>Host an event</button></p> : (
          <div className={rows}>
            {myEvents.map((ev) => <EventRow key={ev.publicKey.toBase58()} ev={ev} perks={perksOf(ev)} active={ev === hostEv} onClick={() => setHostSel(ev.publicKey.toBase58())} />)}
          </div>
        )}
        {hostEv && <CopyLink path={`/?event=${hostEv.publicKey.toBase58()}`} />}
        {hostEv && (hostEv.account.sold === 0
          ? <button className={btn2} disabled={busy} onClick={() => deleteEvent(hostEv)}>Delete event</button>
          : <p className="text-base text-zinc-400">Tickets are sold, so this event can&apos;t be deleted.</p>)}
      </section>
      {hostEv && (
        <section className={`${card} space-y-3`}>
          <h2 className={h2}>Tickets for {parseName(hostEv.account.name).name}</h2>
          <SalesPanel ev={hostEv} tickets={ticketsOf(hostEv)} busy={busy} whoIs={whoIs} onCheckIn={(t) => checkIn(t, hostEv)} />
        </section>
      )}
      <Gate program={program} pk={pk} eventKey={hostEv?.publicKey} busy={busy} checkIn={(t) => run("Checked in", async () => [await checkInIx(t.event, t.ticket, t.owner)])} />
    </>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl">FaceValue</h1>
        <div className="flex items-center gap-2">
          {pk && bal !== null && bal !== "error" && bal.usd && <span className="hidden text-base text-zinc-400 tabular-nums sm:inline">{bal.usd}</span>}
          <ThemeToggle />
          {pk && <AccountMenu pk={pk} bal={bal} email={myEmail} username={myName} others={saved.accounts.filter((a) => a.address !== pk.toBase58())}
            onFunds={getFunds} onSignOut={() => wallet.emailAuth?.logout()} onSwitch={(e) => wallet.emailAuth?.switchTo(e)} onForget={saved.forget} />}
        </div>
      </header>

      {!pk ? (
        <Landing ready={!!wallet.emailAuth?.ready} onSignIn={(e) => wallet.emailAuth?.login(e)} accounts={saved.accounts} onForget={saved.forget} />
      ) : !namesTried ? (
        <p className="mt-10 text-center text-zinc-400">Loading…</p>
      ) : namesLoaded && !names[pk.toBase58()] ? (
        <section className={`${card} mx-auto mt-10 max-w-xl space-y-3`}>
          <h2 className={h2}>Pick a username</h2>
          <p className="text-base text-zinc-400">Required. It is shown under events you create, and you can change it later.</p>
          <div className="flex flex-wrap items-center gap-3">
            <input className={`${input} sm:!w-64`} placeholder="username" aria-label="Username" autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }} />
            <button className={btn} disabled={busy} onClick={saveUsername}>Save</button>
          </div>
          {nameMsg && <p className="text-base text-red-300">{nameMsg}</p>}
        </section>
      ) : (
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
          {/* Phone: fixed bottom tab bar. md and up: left sidebar. */}
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-white/10 bg-[#0b0a12]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:w-44 md:shrink-0 md:flex-col md:gap-1 md:self-start md:border-0 md:bg-transparent md:pb-0">
            {NAV.map(([v, label]) => (
              <button key={v} aria-current={view === v ? "page" : undefined}
                className={`min-h-[52px] flex-1 text-base transition md:min-h-0 md:flex-none md:rounded-lg md:px-3 md:py-2.5 md:text-left ${view === v ? "nav-active font-semibold" : "text-zinc-400 hover:text-inherit"}`}
                onClick={() => { setView(v); if (v === "events") setSel(""); window.scrollTo(0, 0); }}>{label}</button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 space-y-5">
            {loadErr && <ErrorBox e={{ kind: "other", msg: loadErr }} title="Couldn't load events" />}
            {err && <ErrorBox e={err} face={errFace} onClose={() => setErr(null)} />}
            {view === "events" ? eventsView : view === "tickets" ? ticketsView : view === "mine" ? myEventsView : hostView}
          </div>
        </div>
      )}

      {/* Short-lived notices: bottom right on desktop, above the tab bar on phones. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-20 flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {toast && (
          <div role="status" className="surface pointer-events-auto flex items-center gap-4 rounded-lg border border-white/10 px-4 py-3 text-base shadow-xl">
            <span>{toast.text}.</span>
            <a className="text-zinc-400 underline hover:text-inherit" href={explorerTx(toast.sig)} target="_blank" rel="noreferrer">View transaction</a>
            <button className="text-zinc-400 hover:text-inherit" aria-label="Dismiss" onClick={() => setToast(null)}><Icon name="x" className="h-4 w-4" /></button>
          </div>
        )}
        {fundMsg && (
          <div role="status" className="surface pointer-events-auto rounded-lg border border-white/10 px-4 py-3 text-base shadow-xl">{fundMsg}</div>
        )}
      </div>
    </main>
  );
}
