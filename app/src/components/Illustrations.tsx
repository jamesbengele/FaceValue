// Flat outlined illustrations: navy ink lines, pastel fills, dashed detail lines.
// Drawn for FaceValue (tickets, stubs, a gate code); colors come from --art-* tokens in globals.css.
const INK = "var(--art-ink)";
const S = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const DASH = { ...S, fill: "none", strokeDasharray: "6 5" };

// A ticket: rounded rectangle with a half-circle notch in the middle of each short side.
function ticketPath(w: number, h: number, r = 8, n = 9) {
  const m = h / 2;
  return `M${r} 0H${w - r}a${r} ${r} 0 0 1 ${r} ${r}V${m - n}a${n} ${n} 0 0 0 0 ${2 * n}V${h - r}a${r} ${r} 0 0 1 -${r} ${r}H${r}a${r} ${r} 0 0 1 -${r} -${r}V${m + n}a${n} ${n} 0 0 0 0 -${2 * n}V${r}a${r} ${r} 0 0 1 ${r} -${r}Z`;
}

function Ticket({ x, y, w, h, rot, fill, stub = 0.72, label }: { x: number; y: number; w: number; h: number; rot: number; fill: string; stub?: number; label?: string }) {
  const sx = w * stub;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={ticketPath(w, h)} fill={fill} {...S} />
      <path d={`M${sx} 8V${h - 8}`} {...DASH} />
      <path d={`M14 ${h * 0.32}H${sx - 16}M14 ${h * 0.5}H${sx - 34}`} {...DASH} />
      {label && <text x={sx / 2 + 4} y={h * 0.8} textAnchor="middle" fontSize={h * 0.2} fontWeight={800} fill={INK} fontFamily="var(--font-display), sans-serif">{label}</text>}
      <path d={`M${sx + (w - sx) / 2 - 6} ${h / 2}l6 -8l6 8l-6 8Z`} fill="var(--art-yellow)" {...S} />
    </g>
  );
}

// Faceted confetti shard with a dashed inner facet.
function Shard({ x, y, s, rot, fill }: { x: number; y: number; s: number; rot: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 -18L10 -4L6 16L-8 10L-10 -6Z" fill={fill} {...S} />
      <path d="M0 -12L4 0L0 10L-4 0Z" {...DASH} strokeDasharray="3 3" />
    </g>
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -9C1 -2 2 -1 9 0C2 1 1 2 0 9C-1 2 -2 1 -9 0C-2 -1 -1 -2 0 -9Z" fill="var(--art-yellow)" {...S} />;
}

export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 360" className={className} aria-hidden>
      <Shard x={60} y={70} s={1.4} rot={-20} fill="var(--art-lilac)" />
      <Shard x={360} y={60} s={1.1} rot={25} fill="var(--art-mint)" />
      <Shard x={380} y={290} s={1.5} rot={-35} fill="var(--art-pink)" />
      <Shard x={40} y={300} s={1} rot={40} fill="var(--art-yellow)" />
      <Ticket x={70} y={150} w={250} h={110} rot={-14} fill="var(--art-lilac)" label="$50" />
      <Ticket x={110} y={120} w={250} h={110} rot={8} fill="var(--art-pink)" label="$50" />
      <Ticket x={95} y={175} w={250} h={110} rot={-3} fill="var(--art-mint)" label="$50" />
      <Sparkle x={330} y={140} s={1.3} />
      <Sparkle x={90} y={110} />
      <Sparkle x={300} y={320} s={0.9} />
    </svg>
  );
}

export function BuyArt() {
  return (
    <svg viewBox="0 0 220 180" className="h-full w-full" aria-hidden>
      <Shard x={190} y={40} s={1} rot={20} fill="var(--art-lilac)" />
      <Ticket x={30} y={45} w={160} h={74} rot={-10} fill="var(--art-pink)" label="$50" />
      <circle cx={160} cy={130} r={26} fill="var(--art-yellow)" {...S} />
      <circle cx={160} cy={130} r={18} {...DASH} strokeDasharray="4 4" />
      <text x={160} y={137} textAnchor="middle" fontSize={20} fontWeight={800} fill={INK} fontFamily="var(--font-display), sans-serif">$</text>
      <Sparkle x={42} y={30} />
      <Sparkle x={70} y={150} s={0.8} />
    </svg>
  );
}

export function CapArt() {
  return (
    <svg viewBox="0 0 220 180" className="h-full w-full" aria-hidden>
      <Ticket x={22} y={58} w={170} h={78} rot={4} fill="var(--art-lilac)" label="$50" />
      {/* A padlock on the price: the cap is part of the ticket. */}
      <g transform="translate(150 32)">
        <path d="M8 22V14a14 14 0 0 1 28 0v8" fill="none" {...S} strokeWidth={3} />
        <rect x={0} y={22} width={44} height={36} rx={6} fill="var(--art-yellow)" {...S} />
        <circle cx={22} cy={38} r={5} fill={INK} />
        <path d="M22 42v8" {...S} strokeWidth={3} />
      </g>
      {/* "$400" crossed out. */}
      <g transform="translate(30 30) rotate(-8)">
        <text x={0} y={0} fontSize={24} fontWeight={800} fill={INK} opacity={0.55} fontFamily="var(--font-display), sans-serif">$400</text>
        <path d="M-4 -8L62 -4" {...S} strokeWidth={3} stroke="#e5484d" />
      </g>
      <Shard x={30} y={160} s={0.9} rot={-30} fill="var(--art-pink)" />
    </svg>
  );
}

export function GateArt() {
  const cells = [1,1,1,0,1,0,1,1,1, 1,0,1,1,0,1,1,0,1, 1,1,1,0,1,0,1,1,1, 0,1,0,1,1,0,1,0,0, 1,0,1,0,1,1,0,1,1, 0,1,1,1,0,1,0,0,1, 1,1,1,0,0,1,1,0,1, 1,0,1,1,0,0,1,1,0, 1,1,1,0,1,1,0,1,1];
  return (
    <svg viewBox="0 0 220 180" className="h-full w-full" aria-hidden>
      <g transform="translate(62 14) rotate(-6)">
        <rect x={0} y={0} width={96} height={156} rx={16} fill="var(--art-paper)" {...S} />
        <rect x={10} y={14} width={76} height={118} rx={6} fill="var(--art-mint)" {...S} />
        <rect x={34} y={140} width={28} height={6} rx={3} fill={INK} />
        <g transform="translate(17 34)">
          {cells.map((on, i) => on ? <rect key={i} x={(i % 9) * 7} y={Math.floor(i / 9) * 7} width={6} height={6} fill={INK} /> : null)}
        </g>
        <path d="M20 112a28 28 0 0 1 56 0" fill="none" {...S} strokeWidth={4} strokeDasharray="8 6" />
      </g>
      <Sparkle x={40} y={40} s={1.2} />
      <Sparkle x={180} y={150} />
      <Shard x={190} y={50} s={1} rot={30} fill="var(--art-pink)" />
    </svg>
  );
}
