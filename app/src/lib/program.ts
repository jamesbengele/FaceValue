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

export const fanPda = (organizer: PublicKey, fan: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("fan"), organizer.toBuffer(), fan.toBuffer()], programId)[0];
export const perksPda = (event: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("perks"), event.toBuffer()], programId)[0];
// Devnet still runs the build from before set_perks (see commit 630d5c8), whose buy_ticket takes
// ["presale", event] in the perks slot. Remove this and its fallback in App.tsx run() after redeploying.
export const presalePda = (event: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("presale"), event.toBuffer()], programId)[0];
export const discountPda = (event: PublicKey, buyer: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("discount"), event.toBuffer(), buyer.toBuffer()], programId)[0];

export const infoPda = (event: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("info"), event.toBuffer()], programId)[0];

export type EventInfoAcc = { event: PublicKey; startsAt: BN; venue: string; description: string; imageUrl: string };
export type FanPassAcc = { organizer: PublicKey; fan: PublicKey; attended: number; lastEvent: PublicKey };
export type PerksAcc = { event: PublicKey; presaleEndsAt: BN; minAttended: number; discountBps: number };
export type EventAcc = { organizer: PublicKey; eventId: BN; name: string; mint: PublicKey; treasury: PublicKey; facePrice: BN; royaltyBps: number; maxSupply: number; sold: number };
export type TicketAcc = { event: PublicKey; ticketId: number; owner: PublicKey; listed: boolean; askPrice: BN; used: boolean };
export type Row<T> = { publicKey: PublicKey; account: T };
