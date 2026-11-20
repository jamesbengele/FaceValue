// Site footer: logo, link columns and a quiet copyright line, with an oversized faint wordmark underneath.
const REPO = "https://github.com/jamesbengele/UBC-Hackathon";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["Check a ticket", "/check"], ["Host an event", "/?organizer=1"]] },
  { title: "Project", links: [["GitHub", REPO], ["Docs", `${REPO}#readme`], ["Built on Solana", "https://solana.com"]] },
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

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-28 border-t hairline pt-12 [container-type:inline-size]" aria-label="Site footer">
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-[minmax(0,1.6fr)_1fr_1fr]">
        <div className="col-span-full sm:col-span-1">
          <a href="/" className="inline-flex items-center gap-2.5" aria-label="FaceValue home">
            <LogoMark className="h-6 w-auto" /><span className="font-display text-xl">FaceValue</span>
          </a>
          <p className="mt-3 max-w-xs text-sm muted">Student tickets that can&apos;t be resold above face value. Built at UBC.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="mb-3 text-sm muted">{c.title}</p>
            <ul className="space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-[0.95rem] underline-offset-4 hover:underline"
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{label}</a>
                </li>
              ))}
            </ul>
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
