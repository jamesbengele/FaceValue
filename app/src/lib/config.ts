export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = "9gCTdqdJtobM3NxVt262EyfvcrAKmqy7NSaSwpRLRkg2";
export const EVENT_ADDRESS = process.env.NEXT_PUBLIC_EVENT_ADDRESS || "";
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
// Events priced in any other test token can't be bought with the drip, so the list hides them. Unset = show all.
export const DEMO_MINT = process.env.NEXT_PUBLIC_DEMO_MINT || "";
// Where gate QRs send a phone camera. Set it on a laptop dev server (localhost isn't reachable from
// a phone) to the public site, e.g. https://facevalue-blush.vercel.app. Empty: this site.
export const CHECK_BASE = (process.env.NEXT_PUBLIC_CHECK_BASE || "").replace(/\/+$/, "");
// Other sites whose gate codes this site's check page also accepts (codes are signed for the site
// they were made on). Devnet demo only: e.g. "http://localhost:3000" on the public site.
export const EXTRA_GATE_ORIGINS = (process.env.NEXT_PUBLIC_EXTRA_GATE_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
