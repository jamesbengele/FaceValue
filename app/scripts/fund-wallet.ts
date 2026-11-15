// Usage: tsx scripts/fund-wallet.ts <address> [usdc=200]. Mints test USDC of the most recent demo event's mint.
import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { loadDeployer, setup } from "./common";

(async () => {
  const [addr, amt = "200"] = process.argv.slice(2);
  if (!addr) throw new Error("usage: fund-wallet.ts <address> [usdc=200]");
  const owner = new PublicKey(addr);
  const deployer = loadDeployer();
  const { connection, program } = setup(deployer);
  const evs = (await (program.account as any).event.all()).filter((e: any) => e.account.organizer.equals(deployer.publicKey));
  if (!evs.length) throw new Error("No event by the deployer found; run setup-demo first");
  evs.sort((a: any, b: any) => b.account.eventId.cmp(a.account.eventId));
  const mint: PublicKey = evs[0].account.mint;
  const ata = (await getOrCreateAssociatedTokenAccount(connection, deployer, mint, owner)).address;
  await mintTo(connection, deployer, mint, ata, deployer, BigInt(Math.round(Number(amt) * 1_000_000)));
  console.log(`minted ${amt} test USDC (mint ${mint.toBase58()}) to ${ata.toBase58()}`);
})().catch((e) => { console.error(e); process.exit(1); });
