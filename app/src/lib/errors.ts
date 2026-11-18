import { idl } from "./program";

export class SimError extends Error {
  constructor(public logs: string[], public err: unknown) { super("Transaction simulation failed"); }
}
export class NoTokenAccount extends Error {
  constructor() { super("You have no USDC yet. Click Get test funds, then try again."); }
}
export type UiError = { kind: "face"; name: string; msg: string } | { kind: "fv"; name: string; msg: string } | { kind: "other"; msg: string };

// FaceValue error = a name from the IDL's error table, found in the simulation logs or as a Custom code.
export function toUiError(e: any): UiError {
  const logs: string[] = e instanceof SimError ? e.logs : e?.logs ?? [];
  const text = logs.join("\n") + "\n" + (e?.message ?? String(e));
  let found = idl.errors?.find((x) => new RegExp(`Error Code: ${x.name}\\b`).test(text));
  if (!found && e instanceof SimError) {
    const custom = (e.err as any)?.InstructionError?.[1]?.Custom;
    if (typeof custom === "number") found = idl.errors?.find((x) => x.code === custom);
  }
  if (found) return { kind: found.name === "PriceAboveFace" ? "face" : "fv", name: found.name, msg: found.msg ?? found.name };
  if (e instanceof SimError) return { kind: "other", msg: `Simulation failed: ${JSON.stringify(e.err)}\n${logs.slice(-4).join("\n")}` };
  // Privy wraps anything that ends its confirm window without a signature (closed, cancelled, failed) in this message.
  if (/Failed to connect to wallet/i.test(e?.message ?? "")) return { kind: "other", msg: "The confirmation window closed before you approved, so nothing was sent." };
  return { kind: "other", msg: e?.message ?? String(e) };
}
