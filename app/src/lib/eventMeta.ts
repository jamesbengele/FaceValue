// The Event account has no date field and the program is deployed, so the start time rides in the
// onchain name as "<name>|<minutes since epoch, base36>" (the program caps the name at 32 bytes).
export const NAME_MAX_BYTES = 32;
const bytes = (s: string) => new TextEncoder().encode(s).length;

export function encodeName(name: string, startMs: number | null): string {
  return startMs === null ? name : `${name}|${Math.floor(startMs / 60_000).toString(36)}`;
}
export function encodedTooLong(name: string, startMs: number | null): boolean {
  return bytes(encodeName(name, startMs)) > NAME_MAX_BYTES;
}
export function parseName(raw: string): { name: string; startMs: number | null } {
  const i = raw.lastIndexOf("|");
  const mins = i < 0 ? NaN : parseInt(raw.slice(i + 1), 36);
  return /^[0-9a-z]+$/.test(raw.slice(i + 1)) && i >= 0 && Number.isFinite(mins) ? { name: raw.slice(0, i), startMs: mins * 60_000 } : { name: raw, startMs: null };
}
export const fmtStart = (ms: number | null) =>
  ms === null ? "Date to be announced" : new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
