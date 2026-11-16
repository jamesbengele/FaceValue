import assert from "node:assert";
import { encodeName, encodedTooLong, matchesQuery, parseName } from "./eventMeta";

const t = Date.UTC(2026, 10, 20, 19, 0);
assert.deepStrictEqual(parseName(encodeName("UBC Student Section", t)), { name: "UBC Student Section", startMs: t });
assert.deepStrictEqual(parseName("Old event"), { name: "Old event", startMs: null });
assert.deepStrictEqual(parseName("A|B|C!"), { name: "A|B|C!", startMs: null });
assert.strictEqual(encodedTooLong("x".repeat(32), null), false);
assert.strictEqual(encodedTooLong("x".repeat(30), t), true);
assert.strictEqual(matchesQuery("Spring Gala", "  GALA "), true);
assert.strictEqual(matchesQuery("Spring Gala", "winter"), false);
assert.strictEqual(matchesQuery("Spring Gala", ""), true);
assert.strictEqual(matchesQuery(encodeName("Spring Gala", t), "gala"), true);
console.log("eventMeta tests passed");
