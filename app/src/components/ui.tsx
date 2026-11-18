// Shared look. One filled button per screen (`btn`, the main action); everything else is `btn2` or plain text.
export const btn = "btn-primary rounded-lg px-4 py-2.5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
export const btn2 = "rounded-lg border border-white/15 px-4 py-2.5 text-base font-medium transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40";
export const card = "rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6";
export const input = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-base outline-none focus:border-white/40";
export const h2 = "text-xl font-semibold";
// Rows separated by thin lines, no line above the first.
export const rows = "[&>*+*]:border-t [&>*+*]:border-white/10";

const PATHS = {
  sun: "M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z",
  chevron: "m6 9 6 6 6-6",
  x: "M18 6 6 18M6 6l12 12",
  back: "M15 18l-6-6 6-6",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
