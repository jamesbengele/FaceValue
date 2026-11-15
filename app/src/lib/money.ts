export const usd = (base: number | bigint | { toString(): string }) =>
  "$" + (Number(base.toString()) / 1_000_000).toFixed(2);
export const baseToDollarString = (base: number) => (base / 1_000_000).toFixed(2);
// Dollars string -> base units via string math (no float). Returns null when it isn't a number at all.
export function dollarsToBase(s: string): string | null {
  const m = /^\s*(\d*)(?:\.(\d{0,6})\d*)?\s*$/.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  return (BigInt(m[1] || "0") * 1_000_000n + BigInt((m[2] || "").padEnd(6, "0"))).toString();
}
export const short = (k: { toBase58(): string }) => k.toBase58().slice(0, 4) + "…" + k.toBase58().slice(-4);
