"use client";
// The landing hero: a physical-feeling ticket that tilts in 3D with the mouse (or the phone itself)
// and catches the light with a holographic foil. Motion lives in CSS variables set from a ref, so
// tilting never re-renders React. Reduced-motion users get a still ticket with a static foil.
import { useEffect, useRef, useState } from "react";

const W = 400, H = 200, R = 14, N = 15, STUB = 292; // ticket geometry in viewBox units

function ticketPath() {
  const m = H / 2;
  return `M${R} 0H${W - R}a${R} ${R} 0 0 1 ${R} ${R}V${m - N}a${N} ${N} 0 0 0 0 ${2 * N}V${H - R}a${R} ${R} 0 0 1 -${R} ${R}H${R}a${R} ${R} 0 0 1 -${R} -${R}V${m + N}a${N} ${N} 0 0 0 0 -${2 * N}V${R}a${R} ${R} 0 0 1 ${R} -${R}Z`;
}
const MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'><path d='${ticketPath()}'/></svg>`)}") center / 100% 100% no-repeat`;
const QR = [1,1,1,0,1,1,1, 1,0,1,1,1,0,1, 1,1,1,0,1,1,1, 0,1,0,1,0,0,1, 1,1,0,1,1,0,1, 1,0,1,0,0,1,0, 1,1,1,0,1,1,1];

export default function HoloTicket() {
  const scene = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [needsMotionTap, setNeedsMotionTap] = useState(false);

  useEffect(() => {
    const el = card.current, sc = scene.current;
    if (!el || !sc) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    // x, y in 0..1 across the card; (0.5, 0.5) is flat.
    const set = (x: number, y: number, active: boolean) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${(0.5 - y) * 22}deg`);
        el.style.setProperty("--ry", `${(x - 0.5) * 28}deg`);
        el.style.setProperty("--px", `${x * 100}%`);
        el.style.setProperty("--py", `${y * 100}%`);
        el.style.setProperty("--foil", `${x * 100}% ${y * 100}%`);
        el.dataset.active = active ? "1" : "0";
      });
    };
    const onMove = (e: PointerEvent) => {
      const r = sc.getBoundingClientRect();
      set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), true);
    };
    const onLeave = () => set(0.5, 0.5, false);
    sc.addEventListener("pointermove", onMove);
    sc.addEventListener("pointerleave", onLeave);

    // Phones: tilt with the device. Neutral is the phone held at ~45 degrees.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      set(Math.min(1, Math.max(0, 0.5 + e.gamma / 50)), Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 50)), true);
    };
    const DOE = (window as any).DeviceOrientationEvent;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (coarse && DOE && typeof DOE.requestPermission === "function") setNeedsMotionTap(true); // iOS asks first
    else if (coarse) window.addEventListener("deviceorientation", onTilt);

    (sc as any)._enableMotion = async () => {
      try {
        if ((await DOE.requestPermission()) === "granted") { window.addEventListener("deviceorientation", onTilt); setNeedsMotionTap(false); }
      } catch { setNeedsMotionTap(false); }
    };
    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("pointermove", onMove);
      sc.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  return (
    <div ref={scene} className="holo-scene relative flex w-full flex-col items-center justify-center gap-4 py-6">
      <div ref={card} className="holo-ticket" data-active="0">
        <div className="holo-body" style={{ mask: MASK, WebkitMask: MASK }}>
          <div className="holo-base" />
          <div className="holo-foil" />
          <div className="holo-glare" />
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={ticketPath()} fill="none" stroke="var(--art-ink)" strokeWidth="4" />
            <path d={`M${STUB} 14V${H - 14}`} stroke="var(--art-ink)" strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round" />
            <g transform={`translate(${STUB + 26} 54)`}>
              <rect x="-6" y="-6" width="68" height="68" rx="6" fill="#fff" stroke="var(--art-ink)" strokeWidth="1.6" />
              {QR.map((on, i) => on ? <rect key={i} x={(i % 7) * 8} y={Math.floor(i / 7) * 8} width="7" height="7" fill="var(--art-ink)" /> : null)}
            </g>
            <text x={STUB + 54} y="150" textAnchor="middle" fontSize="11" fontFamily="ui-monospace, monospace" fill="var(--art-ink)">#0007</text>
            <text x={STUB + 54} y="168" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="var(--art-ink)" opacity="0.7">ADMIT ONE</text>
          </svg>
          <div className="holo-text">
            <p className="holo-mono">/ face value ticket</p>
            <p className="holo-title">UBC Student Section</p>
            <p className="holo-sub">Thunderbird Arena · Fri 8:00 PM</p>
            <div className="holo-seats">
              {[["SEC", "A"], ["ROW", "4"], ["SEAT", "12"]].map(([k, v]) => <span key={k}><b>{v}</b>{k}</span>)}
            </div>
            <p className="holo-price">$50<span>face value · capped</span></p>
          </div>
        </div>
      </div>
      {needsMotionTap && (
        <button className="relative rounded-full border-[1.5px] border-[var(--art-ink)] bg-white/80 px-3 py-1 text-sm text-[var(--art-ink)]"
          onClick={() => (scene.current as any)?._enableMotion?.()}>Tap to tilt with your phone</button>
      )}
    </div>
  );
}
