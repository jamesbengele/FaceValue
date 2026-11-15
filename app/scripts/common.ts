import { AnchorProvider, Program, Wallet, Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || "https://api.devnet.solana.com";
export const PROGRAM_ID = new PublicKey("2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G");

export function loadDeployer(): Keypair {
  const p = process.env.DEPLOYER_KEYPAIR || path.resolve(__dirname, "../../.keys/deployer.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
}

export function setup(deployer: Keypair) {
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(deployer), { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/idl/facevalue.json"), "utf8")) as Idl;
  return { connection, program: new Program(idl, PROGRAM_ID, provider) };
}
