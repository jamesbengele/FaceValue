export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = "2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G";
export const EVENT_ADDRESS = process.env.NEXT_PUBLIC_EVENT_ADDRESS || "";
export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
