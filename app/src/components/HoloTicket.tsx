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
  BARS.forEach((w, i) => { if (i % 2 === 0) els.push(<rect key={i} x={x} y={0} width={w} height={120} fill="#f4f4f6" />); x += w + 1.2; });
  return <>{els}</>;
}

export type TicketTone = "white" | "lime" | "lilac";
export type TicketInfo = { title: string; place: string; price: number; seats: [string, string][]; tone: TicketTone; number: string };
const TONES: Record<TicketTone, [string, string]> = {
  white: ["#ffffff", "#f1f1f4"],
  lime: ["#ecffb8", "#c6ff3d"],
  lilac: ["#efe9ff", "#cdbdff"],
};

function Face({ back, t }: { back?: boolean; t: TicketInfo }) {
  return (
    <div className={`spin-face ${back ? "spin-back" : ""}`}>
      <div className="spin-body" style={{ mask: MASK, WebkitMask: MASK }}>
        <div className={back ? "spin-back-base" : "spin-front-base"} style={back ? undefined : { background: `linear-gradient(135deg, ${TONES[t.tone][0]} 0%, ${TONES[t.tone][1]} 100%)` }} />
        <div className="spin-foil" />
        <div className="spin-glare" />
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={ticketPath()} fill="none" stroke={back ? "rgba(255,255,255,0.14)" : "rgba(13,13,15,0.1)"} strokeWidth="3" />
          <path d={`M${back ? W - STUB : STUB} 16V${H - 16}`} stroke={back ? "rgba(255,255,255,0.3)" : "rgba(13,13,15,0.22)"} strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
          {back ? (
            <g transform={`translate(${(W - STUB - 76) / 2} 40)`}><Barcode /></g>
          ) : (
            <g transform={`translate(${STUB + 27} 52)`}>
              {QR.map((on, i) => on ? <rect key={i} x={(i % 7) * 8} y={Math.floor(i / 7) * 8} width="7" height="7" rx="1" fill="#0d0d0f" /> : null)}
              <text x="27" y="88" textAnchor="middle" fontSize="10" fill="#6b6b73" fontFamily="var(--font-sans), sans-serif" letterSpacing="1">#{t.number}</text>
            </g>
          )}
        </svg>
        {back ? (
          <div className="spin-back-text">
            <p style={{ marginTop: 0, color: "#c6ff3d" }}>FaceValue</p>
            <h4>Never above face value.</h4>
            <p>This ticket can&apos;t be resold for more than ${t.price}. The rule lives in the ticket itself, so nobody can override it.</p>
          </div>
        ) : (
          <div className="spin-text">
            <p className="spin-kicker">FACEVALUE · STUDENT TICKET</p>
            <p className="spin-title">{t.title}</p>
            <p className="spin-sub">{t.place}</p>
            <div className="spin-seats">{t.seats.map(([k, v]) => <span key={k}><b>{v}</b>{k}</span>)}</div>
            <p className="spin-price"><b>${t.price}</b><span>face value · capped</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HoloTicket({ ticket, start = -18, idle = 0.22 }: { ticket: TicketInfo; start?: number; idle?: number }) {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const st = stage.current, el = card.current;
    if (!st || !el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let angle = start, vel = 0, tilt = 0, tiltTarget = 0, dragging = false, lastX = 0, lastMove = performance.now(), raf = 0, visible = true;

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
        if (Math.abs(vel) < 0.05 && !reduced && performance.now() - lastMove > 1500) angle += idle; // gentle idle turn
      }
      tilt += (tiltTarget - tilt) * 0.1;
      apply();
      if (visible) raf = requestAnimationFrame(loop);
    };

    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; try { st.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ } };
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
  }, [start, idle]);

  return (
    <div ref={stage} className="spin-stage w-full outline-none" tabIndex={0}
      role="img" aria-label={`A FaceValue ticket for ${ticket.title}, $${ticket.price}, face value capped. Drag or use the arrow keys to spin it.`}>
      <div ref={card} className="spin-ticket">
        <Face t={ticket} />
        <Face back t={ticket} />
      </div>
    </div>
  );
}
