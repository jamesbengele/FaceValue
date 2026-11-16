import assert from "node:assert";
import { dollarsToBase } from "./money";

assert.strictEqual(dollarsToBase("80"), "80000000");
assert.strictEqual(dollarsToBase("50."), "50000000");
assert.strictEqual(dollarsToBase(".5"), "500000");
assert.strictEqual(dollarsToBase("49.999999"), "49999999");
assert.strictEqual(dollarsToBase("0.0000001"), "0"); // under one base unit; the program then rejects 0 with InvalidPrice
for (const bad of ["", ".", "$80", "1e3", "-5", "80,00"]) assert.strictEqual(dollarsToBase(bad), null, bad);
console.log("money tests passed");
