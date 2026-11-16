import { BN, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "@/idl/facevalue.json";
import { PROGRAM_ID } from "./config";

export const idl = idlJson as unknown as Idl;
export const programId = new PublicKey(PROGRAM_ID);

export const makeProgram = (connection: Connection) => new Program(idl, programId, { connection });

export const ticketPda = (event: PublicKey, id: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("ticket"), event.toBuffer(), new BN(id).toArrayLike(Buffer, "le", 4)], programId)[0];
export const eventPda = (organizer: PublicKey, eventId: BN) =>
  PublicKey.findProgramAddressSync([Buffer.from("event"), organizer.toBuffer(), eventId.toArrayLike(Buffer, "le", 8)], programId)[0];

export type EventAcc = { organizer: PublicKey; eventId: BN; name: string; mint: PublicKey; treasury: PublicKey; facePrice: BN; royaltyBps: number; maxSupply: number; sold: number };
export type TicketAcc = { event: PublicKey; ticketId: number; owner: PublicKey; listed: boolean; askPrice: BN; used: boolean };
export type Row<T> = { publicKey: PublicKey; account: T };
