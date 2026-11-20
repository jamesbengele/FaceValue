"use client";
// The landing hero: a two-sided ticket you can spin a full 360°. Drag (mouse or touch) to spin, with
// momentum; when idle it turns slowly on its own. The foil and glare follow the angle. Motion is
// written to CSS variables from one animation loop, so spinning never re-renders React.
import { useEffect, useRef } from "react";

const W = 400, H = 200, R = 16, N = 15, STUB = 292; // ticket geometry in viewBox units

function ticketPath() {
  const m = H / 2;
  return `M${R} 0H${W - R}a${R} ${R} 0 0 1 ${R} ${R}V${m - N}a${N} ${N} 0 0 0 0 ${2 * N}V${H - R}a${R} ${R} 0 0 1 -${R} ${R}H${R}a${R} ${R} 0 0 1 -${R} -${R}V${m + N}a${N} ${N} 0 0 0 0 -${2 * N}V${R}a${R} ${R} 0 0 1 ${R} -${R}Z`;
}
const MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='none'><path d='${ticketPath()}'/></svg>`)}") center / 100% 100% no-repeat`;
const QR = [1,1,1,0,1,1,1, 1,0,1,1,1,0,1, 1,1,1,0,1,1,1, 0,1,0,1,0,0,1, 1,1,0,1,1,0,1, 1,0,1,0,0,1,0, 1,1,1,0,1,1,1];
const BARS = [3,1,2,1,3,2,1,1,2,3,1,2,1,1,3,1,2,2,1,3,1,1,2,1,3];

function Barcode() {
  let x = 0;
  const els: JSX.Element[] = [];
  BARS.forEach((w, i) => { if (i % 2 === 0) els.push(<rect key={i} x={x} y={0} width={w * 1.6} height={120} fill="#f4f4f6" />); x += w * 1.6 + 1.4; });
  return <>{els}</>;
}

function Face({ back }: { back?: boolean }) {
  return (
    <div className={`spin-face ${back ? "spin-back" : ""}`}>
      <div className="spin-body" style={{ mask: MASK, WebkitMask: MASK }}>
        <div className={back ? "spin-back-base" : "spin-front-base"} />
        <div className="spin-foil" />
        <div className="spin-glare" />
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={ticketPath()} fill="none" stroke={back ? "rgba(255,255,255,0.14)" : "rgba(13,13,15,0.1)"} strokeWidth="3" />
          <path d={`M${back ? W - STUB : STUB} 16V${H - 16}`} stroke={back ? "rgba(255,255,255,0.3)" : "rgba(13,13,15,0.22)"} strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
          {back ? (
            <g transform={`translate(${W - STUB - 76} 40)`}><Barcode /></g>
          ) : (
            <g transform={`translate(${STUB + 27} 52)`}>
              {QR.map((on, i) => on ? <rect key={i} x={(i % 7) * 8} y={Math.floor(i / 7) * 8} width="7" height="7" rx="1" fill="#0d0d0f" /> : null)}
              <text x="27" y="88" textAnchor="middle" fontSize="10" fill="#6b6b73" fontFamily="var(--font-sans), sans-serif" letterSpacing="1">ADMIT ONE</text>
            </g>
          )}
        </svg>
        {back ? (
          <div className="spin-back-text">
            <p style={{ marginTop: 0, color: "#c6ff3d" }}>FaceValue</p>
            <h4>Never above face value.</h4>
            <p>This ticket can&apos;t be resold for more than $50. The rule lives in the ticket itself, so nobody can override it.</p>
          </div>
        ) : (
          <div className="spin-text">
            <p className="spin-kicker">FACEVALUE · STUDENT TICKET</p>
            <p className="spin-title">UBC Student Section</p>
            <p className="spin-sub">Thunderbird Arena · Fri 8:00 PM</p>
            <div className="spin-seats">{[["SEC", "A"], ["ROW", "4"], ["SEAT", "12"]].map(([k, v]) => <span key={k}><b>{v}</b>{k}</span>)}</div>
            <p className="spin-price"><b>$50</b><span>face value · capped</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HoloTicket() {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const st = stage.current, el = card.current;
    if (!st || !el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let angle = -18, vel = 0, tilt = 0, tiltTarget = 0, dragging = false, lastX = 0, lastMove = performance.now(), raf = 0, visible = true;

    const apply = () => {
      const a = ((angle % 360) + 360) % 360;
      el.style.setProperty("--ry", `${angle}deg`);
      el.style.setProperty("--rx", `${tilt}deg`);
      el.style.setProperty("--foil", `${(a / 360) * 100}%`);
      el.style.setProperty("--glare", `${100 - ((a + 40) % 180) / 1.8}%`);
    };
    const loop = () => {
      if (!dragging) {
        angle += vel; vel *= 0.95;
        if (Math.abs(vel) < 0.05 && !reduced && performance.now() - lastMove > 1500) angle += 0.22; // gentle idle turn
      }
      tilt += (tiltTarget - tilt) * 0.1;
      apply();
      if (visible) raf = requestAnimationFrame(loop);
    };

    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; st.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      const r = st.getBoundingClientRect();
      tiltTarget = ((r.top + r.height / 2 - e.clientY) / r.height) * 14;
      if (!dragging) return;
      const d = (e.clientX - lastX) * 0.55;
      angle += d; vel = d; lastX = e.clientX; lastMove = performance.now();
    };
    const up = () => { dragging = false; lastMove = performance.now(); };
    const leave = () => { tiltTarget = 0; };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { vel = e.key === "ArrowLeft" ? -6 : 6; lastMove = performance.now(); e.preventDefault(); }
    };
    st.addEventListener("pointerdown", down);
    st.addEventListener("pointermove", move);
    st.addEventListener("pointerup", up);
    st.addEventListener("pointercancel", up);
    st.addEventListener("pointerleave", leave);
    st.addEventListener("keydown", key);
    // Only animate while on screen.
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } });
    io.observe(st);
    apply();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      st.removeEventListener("pointerdown", down); st.removeEventListener("pointermove", move);
      st.removeEventListener("pointerup", up); st.removeEventListener("pointercancel", up);
      st.removeEventListener("pointerleave", leave); st.removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div ref={stage} className="spin-stage flex w-full items-center justify-center py-10 outline-none" tabIndex={0}
      role="img" aria-label="A FaceValue ticket for UBC Student Section, $50, face value capped. Drag or use the arrow keys to spin it.">
      <div ref={card} className="spin-ticket">
        <Face />
        <Face back />
      </div>
    </div>
  );
}
