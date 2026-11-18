// Usernames are off-chain: a wallet signs "FaceValue username: <name>" and the server stores address -> name.
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const normalizeUsername = (s: string) => s.trim().toLowerCase();
export const usernameError = (s: string): string | null =>
  USERNAME_RE.test(normalizeUsername(s)) ? null : "Use 3 to 20 characters: letters, digits or underscore";
export const usernameMessage = (name: string) => `FaceValue username: ${normalizeUsername(name)}`;
