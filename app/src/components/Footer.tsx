// Site footer: a ticket-stub edge with a scrolling ticker, then logo, links and a call to action.
const REPO = "https://github.com/jamesbengele/UBC-Hackathon";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Product", links: [["How it works", "/#how"], ["Check a ticket", "/check"], ["Host an event", "/?organizer=1"]] },
  { title: "Project", links: [["GitHub", REPO], ["Docs", `${REPO}#readme`], ["Built on Solana", "https://solana.com"]] },
];
const TICKER = ["No scalpers", "Face value", "Resale capped", "10 s gate codes", "Built at UBC", "Fans first"];

export function LogoMark({ className = "" }: { className?: string }) {
  // A ticket with a notch on each side and a perforation: the shape the product is about.
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden>
      <path d="M6 2h52a4 4 0 0 1 4 4v10a6 6 0 0 0 0 12v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V28a6 6 0 0 0 0-12V6a4 4 0 0 1 4-4Z" fill="currentColor" />
      <path d="M44 9v26" stroke="var(--logo-cut, var(--footer-bg))" strokeWidth="3" strokeDasharray="3 4" strokeLinecap="round" />
      <text x="23" y="29" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--logo-cut, var(--footer-bg))" fontFamily="var(--font-display), sans-serif">$</text>
    </svg>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer mt-20" aria-label="Site footer">
      <div className="ticket-edge" aria-hidden />
      <div className="ticker overflow-hidden py-4" aria-hidden>
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap font-display text-3xl uppercase sm:text-4xl">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-10">
              {TICKER.map((t) => <span key={t} className="flex items-center gap-10">{t}<span className="ticker-dot">✦</span></span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="footer-body px-5 pb-8 pt-10 sm:px-10 sm:pt-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:gap-8">
          <a href="/" className="col-span-full flex items-center gap-3 self-start lg:col-span-1" aria-label="FaceValue home">
            <LogoMark className="h-12 w-auto sm:h-14" />
            <span className="font-display text-4xl sm:text-5xl">FaceValue</span>
          </a>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <p className="footer-muted mb-3 font-mono text-xs uppercase tracking-[0.2em]">{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="font-semibold underline-offset-4 hover:underline"
                      {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>{label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="col-span-full sm:col-span-1 lg:justify-self-end">
            <a href="/" className="footer-cta inline-flex items-center whitespace-nowrap rounded-xl px-6 py-3.5 text-base font-bold">Get tickets →</a>
          </div>
        </div>
        <div className="footer-rule mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5 font-mono text-sm">
          <span>© FaceValue, {year} · Built at UBC</span>
          <span className="footer-muted">Made on Solana devnet · Not for real money</span>
        </div>
      </div>
    </footer>
  );
}
