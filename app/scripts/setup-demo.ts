// Creates a fresh 6-decimals test mint whose mint authority is the deployer key (devnet; the deployer needs SOL).
import { Connection, Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { RPC_URL } from "../src/lib/config";

(async () => {
  const p = process.env.DEPLOYER_KEYPAIR || path.resolve(__dirname, "../../.keys/deployer.json");
  const deployer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
  const mint = await createMint(new Connection(RPC_URL, "confirmed"), deployer, deployer.publicKey, null, 6);
  console.log("DEMO_MINT=" + mint.toBase58());
})().catch((e) => { console.error(e); process.exit(1); });
