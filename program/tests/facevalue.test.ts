import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, createMint, createAssociatedTokenAccount, mintTo, getAccount,
} from "@solana/spl-token";
import { assert } from "chai";
import { loadDeployer, setup, eventPda, ticketPda, fanPda, perksPda, discountPda, errName } from "./helpers";

const FACE = 50_000_000;
const deployer = loadDeployer();
const { connection, program } = setup(deployer);
const p: any = program; // IDL is loaded at runtime, so methods are untyped
const eventId = Date.now();

const organizer = Keypair.generate();
const A = Keypair.generate();
const B = Keypair.generate();
const C = Keypair.generate();

let mint: PublicKey, otherMint: PublicKey;
let orgTok: PublicKey, aTok: PublicKey, bTok: PublicKey, cTok: PublicKey, bOtherTok: PublicKey;
let ev: PublicKey, t0: PublicKey;

const bal = async (a: PublicKey) => Number((await getAccount(connection, a)).amount);

async function expectErr(name: string, promise: Promise<any>) {
  try {
    await promise;
  } catch (e) {
    assert.equal(errName(e), name, `expected ${name}, got: ${(e as any)?.message}`);
    return;
  }
  assert.fail(`expected ${name} but the call succeeded`);
}

async function createEvt(id: number, name: string, face: number, bps: number, supply: number) {
  const e = eventPda(organizer.publicKey, id);
  await p.methods
    .createEvent(new anchor.BN(id), name, new anchor.BN(face), bps, supply)
    .accounts({
      organizer: organizer.publicKey, event: e, mint, treasury: orgTok, systemProgram: SystemProgram.programId,
    })
    .signers([organizer])
    .rpc();
  return e;
}

async function buy(who: Keypair, whoTok: PublicKey, e: PublicKey, tokOverride?: PublicKey, treasury: PublicKey = orgTok) {
  const st = await p.account.event.fetch(e);
  const t = ticketPda(e, st.sold);
  await p.methods
    .buyTicket()
    .accounts({
      buyer: who.publicKey, event: e, ticket: t, buyerToken: tokOverride ?? whoTok, treasury,
      tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      perks: perksPda(e), fanPass: fanPda(st.organizer, who.publicKey), discount: discountPda(e, who.publicKey),
    })
    .signers([who])
    .rpc();
  return t;
}

const list = (who: Keypair, e: PublicKey, t: PublicKey, price: number) =>
  p.methods.listTicket(new anchor.BN(price))
    .accounts({ owner: who.publicKey, event: e, ticket: t }).signers([who]).rpc();

const cancel = (who: Keypair, t: PublicKey) => p.methods.cancelListing().accounts({ owner: who.publicKey, ticket: t }).signers([who]).rpc();

const resale = (who: Keypair, e: PublicKey, t: PublicKey, sellerTok: PublicKey, buyerTok: PublicKey, max: number) =>
  p.methods.buyResale(new anchor.BN(max))
    .accounts({
      buyer: who.publicKey, event: e, ticket: t, sellerToken: sellerTok, buyerToken: buyerTok,
      treasury: orgTok, tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([who]).rpc();

// fan_pass is derived from the event's real organizer, so a wrong signer still reaches NotOrganizer.
async function checkIn(who: Keypair, e: PublicKey, t: PublicKey, expected?: PublicKey) {
  const fan = (await p.account.ticket.fetch(t)).owner;
  return p.methods.checkIn(expected ?? fan)
    .accounts({ organizer: who.publicKey, event: e, ticket: t, fanPass: fanPda(organizer.publicKey, fan), systemProgram: SystemProgram.programId })
    .signers([who]).rpc();
}

const setPerks = (who: Keypair, e: PublicKey, presaleEndsAt: number, min: number, discountBps = 0) =>
  p.methods.setPerks(new anchor.BN(presaleEndsAt), min, discountBps)
    .accounts({ organizer: who.publicKey, event: e, perks: perksPda(e), systemProgram: SystemProgram.programId })
    .signers([who]).rpc();

const attended = async (fan: PublicKey) => (await p.account.fanPass.fetch(fanPda(organizer.publicKey, fan))).attended;

describe("facevalue", function () {
  this.timeout(600_000);

  before(async () => {
    const tx = new Transaction();
    for (const w of [organizer, A, B, C])
      tx.add(SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: w.publicKey, lamports: 120_000_000 }));
    await sendAndConfirmTransaction(connection, tx, [deployer]);

    mint = await createMint(connection, deployer, deployer.publicKey, null, 6);
    otherMint = await createMint(connection, deployer, deployer.publicKey, null, 6);
    orgTok = await createAssociatedTokenAccount(connection, deployer, mint, organizer.publicKey);
    aTok = await createAssociatedTokenAccount(connection, deployer, mint, A.publicKey);
    bTok = await createAssociatedTokenAccount(connection, deployer, mint, B.publicKey);
    cTok = await createAssociatedTokenAccount(connection, deployer, mint, C.publicKey);
    bOtherTok = await createAssociatedTokenAccount(connection, deployer, otherMint, B.publicKey);
    await mintTo(connection, deployer, mint, aTok, deployer, 500_000_000);
    await mintTo(connection, deployer, mint, bTok, deployer, 200_000_000);
    await mintTo(connection, deployer, mint, cTok, deployer, 100_000_000);
    await mintTo(connection, deployer, otherMint, bOtherTok, deployer, 100_000_000);
  });

  it("1. create_event stores the inputs", async () => {
    ev = await createEvt(eventId, "FaceValue Night", FACE, 500, 2);
    const e = await p.account.event.fetch(ev);
    assert.equal(e.organizer.toBase58(), organizer.publicKey.toBase58());
    assert.equal(e.name, "FaceValue Night");
    assert.equal(e.mint.toBase58(), mint.toBase58());
    assert.equal(e.treasury.toBase58(), orgTok.toBase58());
    assert.equal(e.facePrice.toNumber(), FACE);
    assert.equal(e.royaltyBps, 500);
    assert.equal(e.maxSupply, 2);
    assert.equal(e.sold, 0);
  });

  it("2. A buys at face", async () => {
    const [tr0, a0] = [await bal(orgTok), await bal(aTok)];
    t0 = await buy(A, aTok, ev);
    assert.equal((await p.account.ticket.fetch(t0)).owner.toBase58(), A.publicKey.toBase58());
    assert.equal(await bal(orgTok), tr0 + FACE);
    assert.equal(await bal(aTok), a0 - FACE);
    assert.equal((await p.account.event.fetch(ev)).sold, 1);
  });

  it("3. listing above face -> PriceAboveFace", async () => {
    await expectErr("PriceAboveFace", list(A, ev, t0, 80_000_000));
  });

  it("3b. listing above face by naming a pricier event -> ConstraintHasOne", async () => {
    const pricey = await createEvt(eventId + 4, "Pricey", 1_000_000_000, 0, 1);
    await expectErr("ConstraintHasOne", list(A, pricey, t0, 80_000_000));
  });

  it("4. listing at face works", async () => {
    await list(A, ev, t0, FACE);
    const t = await p.account.ticket.fetch(t0);
    assert.isTrue(t.listed);
    assert.equal(t.askPrice.toNumber(), FACE);
  });

  it("4b. cancel_listing: non-owner -> NotOwner; owner cancels; relist", async () => {
    await expectErr("NotOwner", cancel(B, t0));
    await cancel(A, t0);
    const t = await p.account.ticket.fetch(t0);
    assert.isFalse(t.listed);
    assert.equal(t.askPrice.toNumber(), 0);
    await list(A, ev, t0, FACE);
  });

  it("5. resale: bad seller account, PriceChanged, then exact-ask payment split", async () => {
    await expectErr("InvalidTokenAccount", resale(B, ev, t0, bTok, bTok, FACE));
    await expectErr("PriceChanged", resale(B, ev, t0, aTok, bTok, FACE - 1));
    const [b0, s0, tr0] = [await bal(bTok), await bal(aTok), await bal(orgTok)];
    await resale(B, ev, t0, aTok, bTok, FACE);
    const [b1, s1, tr1] = [await bal(bTok), await bal(aTok), await bal(orgTok)];
    const royalty = Math.floor((FACE * 500) / 10_000);
    assert.equal(b0 - b1, FACE, "buyer pays exactly the ask");
    assert.equal(s1 - s0, FACE - royalty, "seller gets ask - royalty");
    assert.equal(tr1 - tr0, royalty, "treasury gets royalty");
    assert.equal(s1 - s0 + (tr1 - tr0), FACE, "deltas add up to the ask");
    const t = await p.account.ticket.fetch(t0);
    assert.equal(t.owner.toBase58(), B.publicKey.toBase58());
    assert.isFalse(t.listed);
  });

  it("6. A (no longer owner) lists -> NotOwner", async () => {
    await expectErr("NotOwner", list(A, ev, t0, FACE));
  });

  it("7. check-in rules", async () => {
    await expectErr("NotOrganizer", checkIn(A, ev, t0));
    await checkIn(organizer, ev, t0);
    assert.isTrue((await p.account.ticket.fetch(t0)).used);
    await expectErr("TicketUsed", list(B, ev, t0, FACE));
  });

  it("8. buying past max_supply -> SoldOut", async () => {
    const tiny = await createEvt(eventId + 1, "Tiny", FACE, 0, 1);
    await buy(A, aTok, tiny);
    await expectErr("SoldOut", buy(C, cTok, tiny));
  });

  it("9. royalty 1001 -> InvalidRoyalty; wrong-mint buyer account -> InvalidTokenAccount", async () => {
    await expectErr("InvalidRoyalty", createEvt(eventId + 2, "Bad", FACE, 1001, 1));
    await expectErr("InvalidTokenAccount", buy(B, bTok, ev, bOtherTok));
    await expectErr("InvalidTokenAccount", buy(B, bTok, ev, undefined, bTok));
  });

  it("10. royalty rounding floors, seller gets the rest", async () => {
    const e = await createEvt(eventId + 3, "Round", FACE, 333, 1);
    const t = await buy(A, aTok, e);
    const ask = 1_000_001; // 1_000_001*333/10_000 = 33_300.03 -> 33_300
    await list(A, e, t, ask);
    const [b0, s0, tr0] = [await bal(bTok), await bal(aTok), await bal(orgTok)];
    await resale(B, e, t, aTok, bTok, ask);
    const [b1, s1, tr1] = [await bal(bTok), await bal(aTok), await bal(orgTok)];
    assert.equal(tr1 - tr0, 33_300);
    assert.equal(s1 - s0, ask - 33_300);
    assert.equal(b0 - b1, ask);
  });

  let e2: PublicKey;
  it("11. fan pass: created on first check-in, one count per event", async () => {
    await mintTo(connection, deployer, mint, bTok, deployer, 200_000_000);
    assert.equal(await attended(B.publicKey), 1); // test 7 checked in B's ticket
    const t1 = await buy(B, bTok, ev); // B's second ticket at the same event
    await checkIn(organizer, ev, t1);
    assert.equal(await attended(B.publicKey), 1);
    e2 = await createEvt(eventId + 9, "Second Night", FACE, 0, 2);
    await checkIn(organizer, e2, await buy(B, bTok, e2));
    const pass = await p.account.fanPass.fetch(fanPda(organizer.publicKey, B.publicKey));
    assert.equal(pass.attended, 2);
    assert.equal(pass.fan.toBase58(), B.publicKey.toBase58());
    assert.equal(pass.lastEvent.toBase58(), e2.toBase58());
  });

  it("12. early access: fans only until ends_at", async () => {
    const pe = await createEvt(eventId + 5, "Fans First", FACE, 0, 3);
    const endsAt = Math.floor(Date.now() / 1000) + 600;
    await expectErr("NotOrganizer", setPerks(A, pe, endsAt, 2));
    await expectErr("InvalidPerks", setPerks(organizer, pe, endsAt, 0));
    await setPerks(organizer, pe, endsAt, 2);
    await expectErr("PresaleFansOnly", buy(C, cTok, pe));
    const t = await buy(B, bTok, pe);
    assert.equal((await p.account.ticket.fetch(t)).owner.toBase58(), B.publicKey.toBase58());
    await expectErr("SalesStarted", setPerks(organizer, e2, endsAt, 1));
  });

  it("13. fan discount: one discounted ticket per fan per event; non-fans pay face", async () => {
    await mintTo(connection, deployer, mint, bTok, deployer, 200_000_000);
    const de = await createEvt(eventId + 6, "Fan Discount", FACE, 0, 4);
    await expectErr("InvalidPerks", setPerks(organizer, de, 0, 1, 5001)); // above 50%
    await expectErr("InvalidPerks", setPerks(organizer, de, 0, 1, 0)); // no perk on
    await setPerks(organizer, de, 0, 2, 1000); // 10% off for 2+ check-ins, no presale
    const perks = await p.account.perks.fetch(perksPda(de));
    assert.equal(perks.discountBps, 1000);
    assert.equal(perks.presaleEndsAt.toNumber(), 0);

    let [b0, tr0] = [await bal(bTok), await bal(orgTok)];
    await buy(B, bTok, de); // B has 2 check-ins
    assert.equal(b0 - (await bal(bTok)), FACE * 0.9);
    assert.equal((await bal(orgTok)) - tr0, FACE * 0.9);
    const receipt = await connection.getAccountInfo(discountPda(de, B.publicKey));
    assert.equal(receipt?.owner.toBase58(), program.programId.toBase58());

    b0 = await bal(bTok);
    await buy(B, bTok, de); // discount already used
    assert.equal(b0 - (await bal(bTok)), FACE);

    const c0 = await bal(cTok);
    await buy(C, cTok, de); // no check-ins
    assert.equal(c0 - (await bal(cTok)), FACE);
  });

  it("13. check_in names the owner the gate saw -> OwnerChanged", async () => {
    const e = await createEvt(eventId + 10, "Gate Race", FACE, 0, 1);
    const t = await buy(A, aTok, e);
    await expectErr("OwnerChanged", checkIn(organizer, e, t, B.publicKey));
    assert.isFalse((await p.account.ticket.fetch(t)).used);
    await checkIn(organizer, e, t, A.publicKey);
    assert.isTrue((await p.account.ticket.fetch(t)).used);
  });

  it("14. close_event: organizer only, only with nothing sold", async () => {
    const close = (who: Keypair, e: PublicKey) =>
      p.methods.closeEvent().accounts({ organizer: who.publicKey, event: e }).signers([who]).rpc();
    const empty = await createEvt(eventId + 7, "Delete Me", FACE, 0, 1);
    await expectErr("NotOrganizer", close(A, empty));
    await close(organizer, empty);
    assert.isNull(await p.account.event.fetchNullable(empty));
    await expectErr("EventHasTickets", close(organizer, ev)); // ev has sold tickets
  });

  it("15. event info and gifting", async () => {
    const e = await createEvt(eventId + 8, "Gift Night", FACE, 0, 3);
    const info = PublicKey.findProgramAddressSync([Buffer.from("info"), e.toBuffer()], p.programId)[0];
    const setInfo = (who: Keypair) =>
      p.methods.setEventInfo(new anchor.BN(1900000000), "Main Hall", "Doors at 7", "https://x.test/a.png")
        .accounts({ organizer: who.publicKey, event: e, info, systemProgram: SystemProgram.programId }).signers([who]).rpc();
    await expectErr("NotOrganizer", setInfo(A));
    await setInfo(organizer);
    assert.equal((await p.account.eventInfo.fetch(info)).venue, "Main Hall");
    const t = await buy(A, aTok, e);
    const send = (who: Keypair, to: PublicKey) =>
      p.methods.transferTicket().accounts({ owner: who.publicKey, ticket: t, newOwner: to }).signers([who]).rpc();
    await expectErr("NotOwner", send(B, B.publicKey));
    await send(A, B.publicKey);
    assert.equal((await p.account.ticket.fetch(t)).owner.toBase58(), B.publicKey.toBase58());
  });
});
