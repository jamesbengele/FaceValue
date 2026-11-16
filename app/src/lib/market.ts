// Resale listings grouped by ask price, cheapest first. Pure, so it can be tested without a chain.
type Listing = { askPrice: { toString(): string }; ticketId: number };

export function groupByPrice<T extends { account: Listing }>(rows: T[]): { price: bigint; rows: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.account.askPrice.toString();
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([k, rs]) => ({ price: BigInt(k), rows: rs.sort((a, b) => a.account.ticketId - b.account.ticketId) }))
    .sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
}
