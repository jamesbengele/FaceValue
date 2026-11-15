// Creates a fresh 6-decimals test mint, the deployer's token account, and the demo event (devnet; deployer needs SOL).
import { BN } from "@coral-xyz/anchor";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { loadDeployer, setup } from "./common";

(async () => {
  const deployer = loadDeployer();
  const { connection, program } = setup(deployer);
  const mint = await createMint(connection, deployer, deployer.publicKey, null, 6);
  const treasury = (await getOrCreateAssociatedTokenAccount(connection, deployer, mint, deployer.publicKey)).address;
  const eventId = new BN(Date.now());
  const event = PublicKey.findProgramAddressSync(
    [Buffer.from("event"), deployer.publicKey.toBuffer(), eventId.toArrayLike(Buffer, "le", 8)], program.programId)[0];
  await program.methods.createEvent(eventId, "UBC Student Section", new BN(50_000_000), 500, 20)
    .accounts({ organizer: deployer.publicKey, event, mint, treasury, systemProgram: SystemProgram.programId })
    .rpc();
  console.log("mint :", mint.toBase58());
  console.log("event:", event.toBase58());
  console.log("Set NEXT_PUBLIC_EVENT_ADDRESS=" + event.toBase58());
})().catch((e) => { console.error(e); process.exit(1); });
