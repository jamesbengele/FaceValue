"use client";
// Signed-out home. Clean layout (white canvas, grey panels, pill buttons) with one unique piece:
// a ticket you can spin 360°. Nothing here touches the chain; the demos illustrate what the program enforces.
import { useEffect, useState } from "react";
import { btn, btn2 } from "./ui";
import type { SavedAccount } from "@/lib/savedAccounts";
import HoloTicket, { type TicketInfo } from "./HoloTicket";

const FACE = 50;

function ScalpDemo() {
  const [price, setPrice] = useState(120);
  const [tries, setTries] = useState(0);
  const blocked = price > FACE;
  useEffect(() => { if (blocked) setTries((t) => t + 1); }, [blocked]);
  const royalty = (price * 0.05).toFixed(2);

  return (
    <div className="flex h-full flex-col justify-center p-6 sm:p-10">
      <div key={blocked ? `no-${tries}` : "ok"} className={`demo-ticket p-5 ${blocked ? "ticket-shake" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm muted">UBC Student Section</p>
            <p className="font-display text-2xl leading-tight">Thunderbird Arena</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="whitespace-nowrap text-sm muted">Face value</p>
            <p className="font-display text-2xl">${FACE}</p>
          </div>
        </div>
        <div className="demo-perf my-4" aria-hidden />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm muted">Your resale price</p>
            <p className="font-display text-5xl tabular-nums leading-none" style={{ color: blocked ? "var(--bad)" : "var(--good)" }}>${price}</p>
          </div>
          {blocked ? <span className="stamp stamp-no" aria-hidden>Refused</span> : <span className="stamp stamp-ok" aria-hidden>Listed</span>}
        </div>
      </div>

      <label htmlFor="scalp" className="sr-only">Resale price</label>
      <input id="scalp" type="range" min={10} max={200} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))}
        className={`scalp-range mt-7 w-full ${blocked ? "is-blocked" : ""}`} />
      <div className="relative mt-2 h-5 text-sm muted">
        <span className="absolute left-0">$10</span>
        {/* The thumb is 30px wide, so its centre runs from 15px to (100% - 15px), not 0 to 100%. */}
        <span className="absolute -translate-x-1/2" style={{ left: `calc(15px + (100% - 30px) * ${(FACE - 10) / 190})` }}>face ${FACE}</span>
        <span className="absolute right-0">$200</span>
      </div>
      <p aria-live="polite" className="mt-5 min-h-[3rem] text-base muted">
        {blocked
          ? <>The ticket rejects anything over <b className="text-[var(--fg)]">${FACE}</b>. It&apos;s not a policy someone enforces; the code won&apos;t allow it.</>
          : <>Listed at <b className="text-[var(--fg)]">${price}</b>. A fan gets a fair seat and the organizer earns <b className="text-[var(--fg)]">${royalty}</b> in royalty.</>}
      </p>
    </div>
  );
}

// Stand-in for the live gate QR: redraws every 10 s with a countdown ring.
function GateCodeDemo() {
  // 0 until mounted, so the server and the first browser render match (no clock on the server).
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  const win = Math.floor(now / 10_000);
  const left = 10 - Math.floor((now % 10_000) / 1000);
  const cells = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9), c = i % 9;
    if ((r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3)) return true;
    let x = (i + 1) * 2654435761 + win * 40503; x ^= x >>> 13; x = Math.imul(x, 1274126177); return ((x >>> 7) & 1) === 1;
  });
  const ring = 2 * Math.PI * 22;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 sm:p-10">
      <div className="demo-ticket qr-card p-4">
        <div key={win} className="qr-pop grid grid-cols-9 gap-[3px]" aria-hidden>
          {cells.map((on, i) => <span key={i} className="h-3 w-3 rounded-[2px]" style={{ background: on ? "#0d0d0f" : "transparent" }} />)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 52 52" className="shrink-0 -rotate-90" aria-hidden>
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" className="ring-track" />
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" strokeLinecap="round" className="ring-accent"
            strokeDasharray={ring} strokeDashoffset={ring * (1 - left / 10)} style={{ transition: "stroke-dashoffset 0.25s linear" }} />
        </svg>
        <p className="font-display text-3xl tabular-nums">{left}s</p>
        <p className="text-sm muted">until the code changes</p>
      </div>
    </div>
  );
}

const usd0 = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Host-side math: what royalties a capped resale market pays, and what fans keep versus a typical markup.
// Every number comes from the sliders; the only assumption (a 2x markup elsewhere) is stated on screen.
function RoyaltyCalculator() {
  const [price, setPrice] = useState(50);
  const [sold, setSold] = useState(500);
  const [resold, setResold] = useState(30);
  const [royalty, setRoyalty] = useState(5);
  const resales = Math.round((sold * resold) / 100);
  const hostEarns = resales * price * (royalty / 100);
  const fansKeep = resales * price; // a 2x markup would have cost each resale buyer one extra face value
  const sliders: [string, number, number, number, number, (v: number) => void, (v: number) => string][] = [
    ["Ticket price", price, 10, 150, 5, setPrice, (v) => `$${v}`],
    ["Tickets sold", sold, 50, 5000, 50, setSold, (v) => v.toLocaleString("en-US")],
    ["Resold by fans", resold, 0, 60, 5, setResold, (v) => `${v}%`],
    ["Your royalty", royalty, 0, 10, 1, setRoyalty, (v) => `${v}%`],
  ];
  return (
    <div className="card grid gap-8 !rounded-[28px] p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
      <div className="space-y-6">
        {sliders.map(([label, v, min, max, step, set, fmt]) => (
          <label key={label} className="block">
            <span className="flex items-baseline justify-between text-[0.95rem]"><span className="muted">{label}</span><span className="font-medium tabular-nums">{fmt(v)}</span></span>
            <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} className="scalp-range mt-3 w-full" />
          </label>
        ))}
        <p className="text-sm muted">Royalty is set per event and capped at 10% by the program.</p>
      </div>
      <div className="flex flex-col justify-center gap-6">
        <div>
          <p className="text-sm muted">Royalties you earn from resales</p>
          <p className="font-display text-[clamp(2.75rem,6vw,4.25rem)] leading-none tabular-nums">{usd0(hostEarns)}</p>
          <p className="mt-1 text-sm muted">{resales.toLocaleString("en-US")} resales at {usd0(price)}, {royalty}% each</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t hairline pt-6">
          <div><p className="font-display text-3xl tabular-nums">{usd0(fansKeep)}</p><p className="text-sm muted">fans keep vs. a 2× markup</p></div>
          <div><p className="font-display text-3xl tabular-nums">$0</p><p className="text-sm muted">scalper profit</p></div>
        </div>
      </div>
    </div>
  );
}

const COMPARE: [string, string, string][] = [
  ["Resale price", "Whatever a scalper asks", "Capped at face value by the ticket"],
  ["Who earns on resale", "Scalpers and resale sites", "The host, on every resale"],
  ["Fake or copied tickets", "Screenshots and PDFs get resold", "A live code that changes every 10 s"],
  ["Loyal fans", "Treated like everyone else", "Check-ins unlock presales and discounts"],
  ["Fees", "Service fees added at checkout", "A network fee under a cent"],
];

function Comparison() {
  return (
    <div className="overflow-hidden rounded-[28px] border hairline">
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] bg-[var(--panel)] text-sm">
        <span className="p-4 sm:px-6" />
        <span className="p-4 muted sm:px-6">The old way</span>
        <span className="p-4 font-medium sm:px-6">FaceValue</span>
      </div>
      {COMPARE.map(([k, old, fv]) => (
        <div key={k} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] border-t hairline text-[0.95rem]">
          <span className="p-4 font-medium sm:px-6">{k}</span>
          <span className="p-4 muted sm:px-6">{old}</span>
          <span className="flex gap-2 p-4 sm:px-6"><span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--good)" }} />{fv}</span>
        </div>
      ))}
    </div>
  );
}

// A small black glyph before each feature title, like a figure label.
function Glyph({ shape }: { shape: "circle" | "square" | "diamond" }) {
  const cls = "inline-block h-3.5 w-3.5 bg-[var(--fg)]";
  return <span aria-hidden className={shape === "circle" ? `${cls} rounded-full` : shape === "diamond" ? `${cls} rotate-45 rounded-[2px]` : `${cls} rounded-[3px]`} />;
}

const FEATURES: { shape: "circle" | "square" | "diamond"; title: string; text: string; Demo: () => JSX.Element; tint?: boolean }[] = [
  { shape: "circle", title: "Resale is capped inside the ticket", text: "Can't go? List it. Nobody can price it above what you paid, and the host earns a royalty on every resale. Try to scalp this one.", Demo: ScalpDemo },
  { shape: "square", title: "A gate code that can't be screenshotted", text: "Your code changes every 10 seconds, so a screenshot is dead in 20. Any phone camera checks it at the door.", Demo: GateCodeDemo, tint: true },
];


const HERO_TICKET: TicketInfo = { title: "UBC Student Section", place: "Thunderbird Arena · Fri 8:00 PM", price: 50, seats: [["SEC", "A"], ["ROW", "4"], ["SEAT", "12"]], tone: "white", number: "0007" };

type Props = { ready: boolean; onSignIn: (email?: string) => void; accounts: SavedAccount[]; onForget: (address: string) => void };

export default function Landing({ ready, onSignIn, accounts, onForget }: Props) {
  return (
    <div className="landing">
      <section className="pt-14 sm:pt-20">
        <p className="fade-up pill text-sm muted"><span className="live-dot" aria-hidden />Live on Solana devnet · built at UBC</p>
        <h2 className="fade-up font-display mt-6 max-w-4xl text-[clamp(2.75rem,7.5vw,5.75rem)] leading-[0.98]" style={{ animationDelay: "60ms" }}>
          Tickets that can&apos;t be scalped.
        </h2>
        <p className="fade-up mt-5 max-w-xl text-xl muted" style={{ animationDelay: "120ms" }}>
          The resale cap lives inside the ticket itself, so a $50 seat stays a $50 seat. No bots, no markups, no fakes at the door.
        </p>
        <div className="fade-up mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
          <button className={`${btn} !px-6 !py-3`} disabled={!ready} onClick={() => onSignIn()}>Get tickets, it&apos;s free</button>
        </div>
        {accounts.length > 0 && (
          <div className="fade-up mt-8 max-w-md" style={{ animationDelay: "220ms" }}>
            <p className="text-sm muted">Welcome back</p>
            <ul className="mt-2 space-y-2">
              {accounts.slice(0, 4).map((a) => (
                <li key={a.address} className="card flex items-center gap-2 !rounded-2xl p-1.5 pl-4">
                  <button className="min-w-0 flex-1 py-1.5 text-left disabled:opacity-40" disabled={!ready} onClick={() => onSignIn(a.email)}>
                    <span className="block truncate font-medium">{a.username ? `@${a.username}` : a.email}</span>
                    <span className="block truncate text-sm muted">{a.username ? a.email : `${a.address.slice(0, 4)}…${a.address.slice(-4)}`}</span>
                  </button>
                  <button className={`${btn} !px-4 !py-2`} disabled={!ready} onClick={() => onSignIn(a.email)}>Continue</button>
                  <button className="rounded-full px-3 text-xl muted hover:text-[var(--fg)]" aria-label={`Forget ${a.email} on this device`} title="Forget on this device" onClick={() => onForget(a.address)}>×</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="fade-up mx-auto mt-14 w-full max-w-[560px] py-6" style={{ animationDelay: "240ms" }} aria-label="A sample FaceValue ticket">
        <HoloTicket ticket={HERO_TICKET} />
      </section>

      <section className="mt-24">
        <Glyph shape="circle" />
        <h3 className="font-display mt-4 max-w-2xl text-3xl sm:text-5xl">Resale that pays the people who make the event.</h3>
        <p className="mt-4 max-w-2xl text-lg muted">On other sites a resold ticket earns money for a scalper. On FaceValue every resale happens at face value and pays the host a royalty. Try your own numbers.</p>
        <div className="mt-10"><RoyaltyCalculator /></div>
      </section>

      <section className="mt-24">
        <Glyph shape="square" />
        <h3 className="font-display mt-4 max-w-2xl text-3xl sm:text-5xl">The future of ticketing is fair by default.</h3>
        <p className="mt-4 max-w-2xl text-lg muted">The rules live in the ticket itself, not in a policy page someone has to enforce.</p>
        <div className="mt-10"><Comparison /></div>
      </section>

      <section className="mt-24 space-y-20">
        {FEATURES.map(({ shape, title, text, Demo, tint }, i) => (
          <div key={title} className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-14">
            <div className={i % 2 ? "md:order-2" : ""}>
              <Glyph shape={shape} />
              <h3 className="font-display mt-4 text-3xl sm:text-4xl">{title}</h3>
              <p className="mt-3 text-lg muted">{text}</p>
            </div>
            <div className={`card min-h-[320px] overflow-hidden !rounded-[28px] ${tint ? "!bg-[var(--tint)]" : ""} ${i % 2 ? "md:order-1" : ""}`}><Demo /></div>
          </div>
        ))}
      </section>

      <section className="mt-24 grid grid-cols-3 border-y hairline">
        {[["$0", "markup, ever"], ["10 s", "gate code life"], ["5%", "royalty to hosts"]].map(([n, l], i) => (
          <div key={l} className={`px-2 py-8 text-center ${i ? "border-l hairline" : ""}`}>
            <p className="font-display text-4xl sm:text-5xl">{n}</p>
            <p className="mt-1 text-sm muted">{l}</p>
          </div>
        ))}
      </section>


      <section className="mt-24 flex flex-col items-start justify-between gap-6 rounded-[28px] p-8 sm:flex-row sm:items-end sm:p-14" style={{ background: "var(--tint)" }}>
        <h3 className="font-display max-w-xl text-4xl sm:text-6xl">Your seat. Your price.</h3>
        <button className={`${btn} !px-6 !py-3`} disabled={!ready} onClick={() => onSignIn()}>Get tickets, it&apos;s free</button>
      </section>
    </div>
  );
}
