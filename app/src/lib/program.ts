import { AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "@/idl/facevalue.json";
import { PROGRAM_ID } from "./config";
import type { AppWallet } from "./useAppWallet";

export const idl = idlJson as unknown as Idl;
export const programId = new PublicKey(PROGRAM_ID);

// Read-only callers pass a wallet with no publicKey; a throwaway key stands in as fee payer for decoding only.
export function makeProgram(connection: Connection, w: AppWallet) {
  const wallet = {
    publicKey: w.publicKey ?? PublicKey.default,
    signTransaction: async (t: any) => { if (!w.signTransaction) throw new Error("Wallet not connected"); return w.signTransaction(t); },
    signAllTransactions: async (t: any) => { if (!w.signAllTransactions) throw new Error("Wallet not connected"); return w.signAllTransactions(t); },
  };
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  return new Program(idl, programId, provider);
}

export const ticketPda = (event: PublicKey, id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("ticket"), event.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 4)], programId)[0];
export const eventPda = (organizer: PublicKey, eventId: BN) =>
  PublicKey.findProgramAddressSync([Buffer.from("event"), organizer.toBuffer(), eventId.toArrayLike(Buffer, "le", 8)], programId)[0];

export type EventAcc = { organizer: PublicKey; eventId: BN; name: string; mint: PublicKey; treasury: PublicKey; facePrice: BN; royaltyBps: number; maxSupply: number; sold: number };
export type TicketAcc = { event: PublicKey; ticketId: number; owner: PublicKey; listed: boolean; askPrice: BN; used: boolean };
export type Row<T> = { publicKey: PublicKey; account: T };
