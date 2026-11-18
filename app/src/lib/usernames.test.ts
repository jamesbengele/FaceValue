import assert from "node:assert/strict";
import { normalizeUsername, usernameError, usernameMessage } from "./usernames";

assert.equal(usernameError("ab"), "Use 3 to 20 characters: letters, digits or underscore");
assert.equal(usernameError("abc"), null);
assert.equal(usernameError("Muka_26"), null); // case is folded
assert.equal(usernameError("has space"), "Use 3 to 20 characters: letters, digits or underscore");
assert.equal(usernameError("a".repeat(21)), "Use 3 to 20 characters: letters, digits or underscore");
assert.equal(normalizeUsername("  James_B "), "james_b");
assert.equal(usernameMessage("James_B"), "FaceValue username: james_b");
console.log("usernames tests passed");
