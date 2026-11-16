import assert from "node:assert";
import { groupByPrice } from "./market";

const row = (askPrice: number, ticketId: number) => ({ account: { askPrice: { toString: () => String(askPrice) }, ticketId } });
const g = groupByPrice([row(50_000_000, 4), row(45_000_000, 9), row(50_000_000, 1), row(45_000_000, 2), row(100, 7)]);
assert.deepStrictEqual(g.map((x) => x.price), [100n, 45_000_000n, 50_000_000n]); // cheapest first, numeric not string order
assert.deepStrictEqual(g.map((x) => x.rows.length), [1, 2, 2]);
assert.deepStrictEqual(g[2].rows.map((r) => r.account.ticketId), [1, 4]);
assert.deepStrictEqual(groupByPrice([]), []);
console.log("market tests passed");
