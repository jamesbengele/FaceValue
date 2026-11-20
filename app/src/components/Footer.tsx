// Site footer: logo, link columns and a quiet copyright line, with an oversized faint wordmark underneath.
// Signed in, the Product links switch tabs in place (no page reload); signed out they point at the landing.
const REPO = "https://github.com/jamesbengele/UBC-Hackathon";
export type FooterTab = "events" | "tickets" | "mine" | "host";

type Item = { label: string; href?: string; tab?: FooterTab; scrollTo?: string; external?: boolean };

const PROJECT: Item[] = [
  { label: "GitHub", href: REPO, external: true },
  { label: "Docs", href: `${REPO}#readme`, external: true },
  { label: "Built on Solana", href: "https://solana.com", external: true },
];
const PRODUCT_OUT: Item[] = [
  { label: "Check a ticket", href: "/check" },
  { label: "Host an event", href: "/?organizer=1" },
];
const PRODUCT_IN: Item[] = [
  { label: "Events", tab: "events" },
  { label: "My tickets", tab: "tickets" },
  { label: "Host an event", tab: "host" },
  { label: "Check a ticket", href: "/check" },
];

// The mark: a ticket with side notches, a perforation and a "$". Cut-outs use the page background.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden>
      <path d="M6 2h52a4 4 0 0 1 4 4v10a6 6 0 0 0 0 12v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V28a6 6 0 0 0 0-12V6a4 4 0 0 1 4-4Z" fill="currentColor" />
      <path d="M44 9v26" stroke="var(--bg)" strokeWidth="3" strokeDasharray="3 4" strokeLinecap="round" />
      <text x="23" y="29" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--bg)" fontFamily="var(--font-display), sans-serif">$</text>
    </svg>
  );
}

const linkCls = "text-[0.95rem] underline-offset-4 transition hover:underline";

export default function Footer({ onTab }: { onTab?: (tab: FooterTab) => void }) {
  const year = new Date().getFullYear();
  const go = (it: Item) => {
    if (it.tab && onTab) onTab(it.tab);
    else if (it.scrollTo) document.getElementById(it.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const render = (it: Item) =>
    it.href ? (
      <a href={it.href} className={linkCls} {...(it.external ? { target: "_blank", rel: "noreferrer" } : {})}>{it.label}{it.external ? " ↗" : ""}</a>
    ) : (
      <button className={`${linkCls} !min-h-0 text-left`} onClick={() => go(it)}>{it.label}</button>
    );
  const columns: [string, Item[]][] = [["Product", onTab ? PRODUCT_IN : PRODUCT_OUT], ["Project", PROJECT]];

  return (
    <footer className="mt-28 border-t hairline pt-12 [container-type:inline-size]" aria-label="Site footer">
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-[minmax(0,1.6fr)_1fr_1fr]">
        <div className="col-span-full sm:col-span-1">
          <button className="!min-h-0 inline-flex items-center gap-2.5" aria-label="FaceValue home"
            onClick={() => { if (onTab) onTab("events"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <LogoMark className="h-6 w-auto" /><span className="font-display text-xl">FaceValue</span>
          </button>
          <p className="mt-3 max-w-xs text-sm muted">Student tickets that can&apos;t be resold above face value. Built at UBC.</p>
        </div>
        {columns.map(([title, items]) => (
          <nav key={title} aria-label={title}>
            <p className="mb-3 text-sm muted">{title}</p>
            <ul className="space-y-2.5">{items.map((it) => <li key={it.label}>{render(it)}</li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 text-sm muted">
        <span>© {year} FaceValue</span>
        <span>Solana devnet · test money only</span>
      </div>
      <div className="footer-mark mt-6 -mb-[0.12em] overflow-hidden" aria-hidden>FaceValue</div>
    </footer>
  );
}
