"use client";
// Signed-out home: a hook you can play with before signing in.
// Nothing here touches the chain; the scalp demo and the gate code are illustrations of what the program enforces.
import { useEffect, useState } from "react";
import { btn } from "./ui";

const FACE = 50;

function ScalpDemo() {
  const [price, setPrice] = useState(120);
  const [tries, setTries] = useState(0);
  const blocked = price > FACE;
  useEffect(() => { if (blocked) setTries((t) => t + 1); }, [blocked]);
  const royalty = (price * 0.05).toFixed(2);

  return (
    <div className="landing-card relative overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Try it: scalp this ticket</p>

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
      <div className="relative mt-1 h-5 text-sm text-zinc-500">
        <span className="absolute left-0">$10</span>
        {/* The thumb is 30px wide, so its centre runs from 15px to (100% - 15px), not 0 to 100%. */}
        <span className="absolute -translate-x-1/2" style={{ left: `calc(15px + (100% - 30px) * ${(FACE - 10) / 190})` }}>face ${FACE}</span>
        <span className="absolute right-0">$200</span>
      </div>

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
    <div className="landing-card flex items-center gap-5 rounded-3xl border border-white/10 p-5 sm:p-6">
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

const STEPS: [string, string][] = [
  ["Buy at face value", "Sign in with just your email. No crypto wallet, no app to install."],
  ["Resell, but never above face", "Can't go? List it. The cap is built into the ticket, and the organizer earns a royalty."],
  ["Walk in with a live code", "A rotating code proves it's really you. Screenshots and scams don't scan."],
];

export default function Landing({ ready, onSignIn }: { ready: boolean; onSignIn: () => void }) {
  return (
    <div className="landing pb-10">
      <section className="relative pt-10 sm:pt-16">
        <div className="hero-glow" aria-hidden />
        <div className="float-ticket ft-1" aria-hidden>$50</div>
        <div className="float-ticket ft-2" aria-hidden>$50</div>
        <div className="float-ticket ft-3" aria-hidden>$50</div>
        <p className="fade-up inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-400">
          <span className="live-dot" aria-hidden /> Live on Solana devnet · built at UBC
        </p>
        <h2 className="fade-up font-display mt-6 text-[clamp(3rem,11vw,7.5rem)] leading-[0.92] tracking-tight" style={{ animationDelay: "60ms" }}>
          Face value.<br /><span className="hero-accent">Every time.</span>
        </h2>
        <p className="fade-up mt-6 max-w-xl text-xl text-zinc-400" style={{ animationDelay: "120ms" }}>
          Student tickets that physically can&apos;t be scalped. The resale cap lives inside the ticket, so a $50 seat stays a $50 seat.
        </p>
        <div className="fade-up mt-8 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
          <button className={`${btn} !px-7 !py-4 !text-lg`} disabled={!ready} onClick={onSignIn}>Get tickets: sign in with email</button>
          <span className="text-base text-zinc-500">Free test money on sign-up. Takes 20 seconds.</span>
        </div>
      </section>

      <section className="mt-14 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <ScalpDemo />
        <div className="space-y-5 fade-up" style={{ animationDelay: "260ms" }}>
          <GateCodeDemo />
          <div className="landing-card grid grid-cols-3 divide-x divide-white/10 rounded-3xl border border-white/10 py-5 text-center">
            {[["$0", "markup, ever"], ["10 s", "gate code life"], ["5%", "royalty to hosts"]].map(([n, l]) => (
              <div key={l} className="px-2"><p className="font-display text-3xl sm:text-4xl">{n}</p><p className="text-sm text-zinc-400">{l}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h3 className="font-display text-4xl sm:text-5xl">How it works</h3>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="landing-card fade-up rounded-3xl border border-white/10 p-6" style={{ animationDelay: `${320 + i * 90}ms` }}>
              <span className="font-display text-5xl text-zinc-500">0{i + 1}</span>
              <p className="mt-3 text-xl font-semibold">{t}</p>
              <p className="mt-2 text-base text-zinc-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-card mt-16 rounded-3xl border border-white/10 px-6 py-12 text-center sm:py-16">
        <h3 className="font-display text-4xl sm:text-6xl">Your seat. Your price.</h3>
        <p className="mx-auto mt-3 max-w-md text-lg text-zinc-400">No bots, no $400 resale for a $50 ticket.</p>
        <button className={`${btn} mt-8 !px-7 !py-4 !text-lg`} disabled={!ready} onClick={onSignIn}>Sign in with email</button>
      </section>
    </div>
  );
}
