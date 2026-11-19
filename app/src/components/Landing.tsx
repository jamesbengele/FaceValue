"use client";
// Signed-out home: a hook you can play with before signing in.
// Nothing here touches the chain; the scalp demo and the gate code are illustrations of what the program enforces.
import { useEffect, useRef, useState } from "react";
import { ding, thunk } from "@/lib/sounds";
import { btn } from "./ui";
import type { SavedAccount } from "@/lib/savedAccounts";
import { BuyArt, CapArt, GateArt, HeroArt } from "./Illustrations";
import HoloTicket from "./HoloTicket";

const FACE = 50;

function ScalpDemo() {
  const [price, setPrice] = useState(120);
  const [tries, setTries] = useState(0);
  const blocked = price > FACE;
  // Each time the price crosses face value: a thunk going over, a ding coming back under. Not on first render.
  const first = useRef(true);
  useEffect(() => {
    if (blocked) setTries((t) => t + 1);
    if (first.current) { first.current = false; return; }
    if (blocked) thunk(); else ding();
  }, [blocked]);
  const royalty = (price * 0.05).toFixed(2);

  return (
    <div className="boxed relative overflow-hidden p-5 sm:p-8">
      <p className="font-mono text-sm text-zinc-400">/ try it: scalp this ticket</p>

      <div key={blocked ? `no-${tries}` : "ok"} className={`ticket mt-5 rounded-2xl p-4 sm:p-5 ${blocked ? "ticket-shake" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">UBC Student Section</p>
            <p className="font-display text-2xl leading-tight sm:text-3xl">Thunderbird Arena</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="whitespace-nowrap text-sm text-zinc-400">Face value</p>
            <p className="font-display text-2xl sm:text-3xl">${FACE}</p>
          </div>
        </div>
        <div className="ticket-perf my-4" aria-hidden />
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Your resale price</p>
            <p className={`font-display text-5xl tabular-nums leading-none ${blocked ? "text-red-300" : "text-emerald-300"}`}>${price}</p>
          </div>
          {blocked
            ? <span className="stamp stamp-no" aria-hidden>Refused</span>
            : <span className="stamp stamp-ok" aria-hidden>Listed</span>}
        </div>
      </div>

      <label htmlFor="scalp" className="sr-only">Resale price</label>
      <input id="scalp" type="range" min={10} max={200} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))}
        className={`scalp-range mt-6 w-full ${blocked ? "is-blocked" : ""}`} />
      <div className="mt-1 flex justify-between text-sm text-zinc-500"><span>$10</span><span>face ${FACE}</span><span>$200</span></div>

      <p aria-live="polite" className="mt-4 min-h-[3.5rem] text-lg">
        {blocked
          ? <>The ticket itself rejects anything over <b>${FACE}</b>. Not a policy someone has to enforce: the code won&apos;t let it happen.</>
          : <>Listed at <b>${price}</b>. A fan gets a fair seat, and the organizer still earns <b>${royalty}</b> royalty on the resale.</>}
      </p>
    </div>
  );
}

// Decorative stand-in for the live gate QR: re-draws every 10 s with a countdown ring.
function GateCodeDemo() {
  // 0 until mounted, so the server and the first browser render match (no clock on the server).
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  const win = Math.floor(now / 10_000);
  const left = 10 - Math.floor((now % 10_000) / 1000);
  const cells = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9), c = i % 9;
    const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
    if (finder) return true;
    let x = (i + 1) * 2654435761 + win * 40503; x ^= x >>> 13; x = Math.imul(x, 1274126177); return ((x >>> 7) & 1) === 1;
  });
  const ring = 2 * Math.PI * 22;

  return (
    <div className="boxed flex items-center gap-5 p-5 sm:p-6">
      <div key={win} className="qr-pop grid shrink-0 grid-cols-9 gap-[2px] rounded-xl bg-white p-2" aria-hidden>
        {cells.map((on, i) => <span key={i} className={`h-[9px] w-[9px] rounded-[1px] ${on ? "bg-black" : "bg-transparent"}`} />)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90" aria-hidden>
            <circle cx="26" cy="26" r="22" fill="none" strokeWidth="4" className="stroke-white/10" />
            <circle cx="26" cy="26" r="22" fill="none" strokeWidth="4" strokeLinecap="round" className="ring-accent"
              strokeDasharray={ring} strokeDashoffset={ring * (1 - left / 10)} style={{ transition: "stroke-dashoffset 0.25s linear" }} />
          </svg>
          <p className="font-display text-4xl tabular-nums">{left}s</p>
        </div>
        <p className="mt-2 text-lg font-semibold">Your gate code changes every 10 seconds.</p>
        <p className="text-base text-zinc-400">A screenshot is dead in 20. Any phone camera checks it at the door.</p>
      </div>
    </div>
  );
}

const STEPS: { title: string; tag: string; text: string; Art: () => JSX.Element; panel: string }[] = [
  { title: "Buy at face value", tag: "sign in with just your email", text: "No crypto wallet, no app to install. You get test money on sign-up and buy in two taps.", Art: BuyArt, panel: "panel-pink" },
  { title: "Resell, never above face", tag: "the cap lives inside the ticket", text: "Can't go? List it. Nobody can price it above what you paid, and the organizer earns a royalty on every resale.", Art: CapArt, panel: "panel-lilac" },
  { title: "Walk in with a live code", tag: "a new code every 10 seconds", text: "A rotating code proves it's really you. Screenshots die in 20 seconds, and any phone camera checks it at the door.", Art: GateArt, panel: "panel-mint" },
];

type Props = { ready: boolean; onSignIn: (email?: string) => void; accounts: SavedAccount[]; onForget: (address: string) => void };

export default function Landing({ ready, onSignIn, accounts, onForget }: Props) {
  return (
    <div className="landing pb-6">
      <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-stretch">
        <div className="boxed flex flex-col justify-center p-6 sm:p-10">
          <p className="fade-up flex items-center gap-2 font-mono text-sm text-zinc-400"><span className="live-dot" aria-hidden /> / live on solana devnet · built at UBC</p>
          <h2 className="fade-up font-display mt-5 text-[clamp(2.8rem,8vw,5.6rem)] leading-[0.95] tracking-tight" style={{ animationDelay: "60ms" }}>
            Face value.<br /><span className="hero-accent">Every time.</span>
          </h2>
          <p className="fade-up mt-4 text-lg text-zinc-400" style={{ animationDelay: "100ms" }}>- student tickets that can&apos;t be scalped -</p>
          <p className="fade-up mt-4 max-w-lg text-lg" style={{ animationDelay: "120ms" }}>
            The resale cap lives inside the ticket itself, so a $50 seat stays a $50 seat. No bots, no markups, no fakes at the door.
          </p>
          {accounts.length > 0 && (
            <div className="fade-up mt-7" style={{ animationDelay: "150ms" }}>
              <p className="font-mono text-sm text-zinc-400">/ welcome back</p>
              <ul className="mt-2 space-y-2">
                {accounts.slice(0, 4).map((a) => (
                  <li key={a.address} className="boxed flex items-center gap-2 p-1.5 pl-4">
                    <button className="min-w-0 flex-1 py-1.5 text-left disabled:opacity-40" disabled={!ready} onClick={() => onSignIn(a.email)}>
                      <span className="block truncate text-lg font-semibold">{a.username ? `@${a.username}` : a.email}</span>
                      <span className="block truncate text-sm text-zinc-400">{a.username ? a.email : `${a.address.slice(0, 4)}…${a.address.slice(-4)}`}</span>
                    </button>
                    <button className={`${btn} !px-4 !py-2`} disabled={!ready} onClick={() => onSignIn(a.email)}>Continue</button>
                    <button className="px-3 text-xl text-zinc-400 hover:opacity-70" aria-label={`Forget ${a.email} on this device`} title="Forget on this device" onClick={() => onForget(a.address)}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="fade-up mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
            <button className={`${btn} !px-7 !py-4 !text-lg`} disabled={!ready} onClick={() => onSignIn()}>Get tickets: sign in with email</button>
            <span className="text-base text-zinc-500">Free test money. Takes 20 seconds.</span>
          </div>
        </div>
        <div className="boxed panel-lilac relative flex items-center justify-center overflow-hidden p-4 sm:p-8">
          <HeroArt className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />
          <HoloTicket />
        </div>
      </section>

      <section className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <ScalpDemo />
        <div className="space-y-6">
          <GateCodeDemo />
          <div className="boxed grid grid-cols-3 divide-x divide-[var(--ink-line)] py-5 text-center">
            {[["$0", "markup, ever"], ["10 s", "gate code life"], ["5%", "royalty to hosts"]].map(([n, l]) => (
              <div key={l} className="px-2"><p className="font-display text-3xl sm:text-4xl">{n}</p><p className="text-sm text-zinc-400">{l}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mt-16 scroll-mt-6">
        <p className="font-mono text-sm text-zinc-400">/ how it works</p>
        <h3 className="font-display mt-2 text-4xl sm:text-5xl">Three steps, zero scalpers.</h3>
        <ol className="mt-8 space-y-8">
          {STEPS.map(({ title, tag, text, Art, panel }, i) => (
            <li key={title} className="boxed grid overflow-hidden md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className={`${panel} aspect-[4/3] border-b-[1.5px] border-[var(--ink-line)] p-6 md:aspect-auto md:min-h-[260px] md:border-b-0 md:border-r-[1.5px]`}><Art /></div>
              <div className="flex flex-col p-6 sm:p-10">
                <p className="font-mono text-sm text-zinc-400">/ 0{i + 1}</p>
                <p className="mt-3 text-2xl font-bold sm:text-3xl">{title}</p>
                <p className="mt-1 text-base text-zinc-400">- {tag} -</p>
                <p className="mt-6 text-lg md:mt-auto md:pt-10">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="boxed panel-yellow mt-16 grid items-center gap-6 overflow-hidden p-8 sm:p-12 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-sm art-ink-soft">/ your seat, your price</p>
          <h3 className="font-display art-ink mt-2 text-4xl sm:text-6xl">No $400 resale for a $50 ticket.</h3>
        </div>
        <button className="art-cta px-7 py-4 text-lg font-bold disabled:opacity-40" disabled={!ready} onClick={() => onSignIn()}>Sign in with email →</button>
      </section>
    </div>
  );
}
