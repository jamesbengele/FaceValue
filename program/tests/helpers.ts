// All Anchor-version-specific code lives here (written for Anchor 0.29, OLD IDL format).
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G"
);
export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

export function loadKeypair(p: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
}

export function loadDeployer(): Keypair {
  return loadKeypair(
    process.env.DEPLOYER_KEYPAIR || path.resolve(__dirname, "../../.keys/deployer.json")
  );
}

export function setup(deployer: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(deployer), {
    commitment: "confirmed",
  });
  const idl = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../app/src/idl/facevalue.json"), "utf8")
  );
  // Old-format IDL: programId is passed explicitly. For a 0.30+ IDL use new anchor.Program(idl, provider).
  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);
  return { connection, provider, program };
}

export function eventPda(organizer: PublicKey, eventId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("event"), organizer.toBuffer(), new anchor.BN(eventId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}

export function ticketPda(event: PublicKey, id: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), event.toBuffer(), new anchor.BN(id).toArrayLike(Buffer, "le", 4)],
    PROGRAM_ID
  )[0];
}

export function fanPda(organizer: PublicKey, fan: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("fan"), organizer.toBuffer(), fan.toBuffer()], PROGRAM_ID)[0];
}

export function perksPda(event: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("perks"), event.toBuffer()], PROGRAM_ID)[0];
}

export function discountPda(event: PublicKey, buyer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("discount"), event.toBuffer(), buyer.toBuffer()], PROGRAM_ID)[0];
}

// Returns the Anchor error name from whatever shape the failure arrives in.
export function errName(e: any): string | undefined {
  const code = e?.error?.errorCode?.code;
  if (code) return code;
  const logs: string[] = e?.logs || e?.transactionLogs || e?.simulationResponse?.logs || [];
  const text = logs.join("\n") + "\n" + (e?.message || "") + "\n" + String(e);
  return /Error Code: (\w+)/.exec(text)?.[1];
}
