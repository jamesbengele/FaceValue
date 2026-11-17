export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = "9gCTdqdJtobM3NxVt262EyfvcrAKmqy7NSaSwpRLRkg2";
export const EVENT_ADDRESS = process.env.NEXT_PUBLIC_EVENT_ADDRESS || "";
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
