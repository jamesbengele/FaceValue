// Shared look. One filled button per screen (`btn`, the main action); everything else is `btn2` or plain text.
export const btn = "btn-primary inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
export const btn2 = "btn-secondary inline-flex items-center justify-center whitespace-nowrap rounded-full px-5 py-2.5 text-base font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
export const card = "card p-5 sm:p-7";
export const input = "w-full rounded-xl border border-[var(--hair)] bg-[var(--field)] px-3.5 py-2.5 text-base outline-none transition focus:border-[var(--fg)]";
export const h2 = "font-display text-2xl";
// Rows separated by thin lines, no line above the first.
export const rows = "[&>*+*]:border-t [&>*+*]:border-[var(--hair)]";

const PATHS = {
  sun: "M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z",
  chevron: "m6 9 6 6 6-6",
  x: "M18 6 6 18M6 6l12 12",
  back: "M15 18l-6-6 6-6",
  // Gear (Lucide "settings", ISC license): outline plus the centre circle in one path.
  settings: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
};

export function Icon({ name, className = "h-5 w-5" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
