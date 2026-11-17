# FaceValue (UBC build)

Student tickets that can't be resold above face value, enforced by the Solana program itself. Spec: [SPEC.md](SPEC.md). Demo script: [docs/DEMO.md](docs/DEMO.md). Prompt log: [PROMPTS.md](PROMPTS.md).

Features: USDC-style SPL token payments, organizer royalty on resales, rotating gate code (no camera needed), email sign-in (Privy), resale listings grouped by price (cheapest first), and fan loyalty: check-ins are counted onchain per organizer, and an organizer can reward fans with enough check-ins with a fans-only presale and a discount on one ticket at the next event (SPEC §4b; needs the program redeployed with `set_perks`).

## Layout
`program/` Anchor program (`src/lib.rs`) and devnet tests · `app/` Next.js app (IDL: `app/src/idl/facevalue.json`).

## Deployed
Devnet program `2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G`. Test mint `4UDrCVHBaJRVYFVCfNjzjseJAgp25Kywz6qZBX3hAWd6` (our own, deployer is mint authority).

## Deploy your own copy (Solana Playground, Anchor 0.29)
Local `cargo build-sbf` needs a C linker (MSVC build tools); on a machine with one it can be used instead.
1. beta.solpg.io: new Anchor project, paste `program/src/lib.rs`, connect the Playground wallet, fund it with devnet SOL (the faucet needs a human: faucet.solana.com).
2. Build (Playground rewrites `declare_id!`; copy that line back into `program/src/lib.rs`, `program/tests/helpers.ts` and `app/src/lib/config.ts`), then Deploy. Over the public RPC this took ~25 min for 314 KB.
3. Replace `app/src/idl/facevalue.json` (the one IDL file) with the IDL Playground produced.

## Run the tests (devnet)
```bash
cd program && npm install
# deployer needs ~0.3 SOL; set DEPLOYER_KEYPAIR to a funded keypair file (default ../.keys/deployer.json)
npx mocha -r tsx tests/*.test.ts --timeout 120000
```
Tests mint their own token and fund wallets by transfer; no airdrops.

## Run the app
```bash
cd app && npm install        # .npmrc sets legacy-peer-deps (Privy peer deps)
npm run setup-demo           # creates a test mint only; copy it into app/.env.local as DEMO_MINT
npm run dev                  # http://localhost:3000   (sidebar: Events, My tickets, Host an event; ?organizer=1 opens Host)
```
`app/.env.local`: `DEMO_MINT` (used by `/api/drip`); `NEXT_PUBLIC_PRIVY_APP_ID` is required (email is the only sign-in; without it the app shows only a setup notice, see [app/README-email.md](app/README-email.md)); `NEXT_PUBLIC_RPC_URL` should be a private devnet RPC, because the public one rate-limits with three windows; `NEXT_PUBLIC_EVENT_ADDRESS` opens that event first (optional; all events are listed). Wallets need a little devnet SOL for ticket-account rent and fees.

## Limits to know
- Gate codes last under ~90 s and defeat screenshots, not a holder forwarding a live code.
- Email wallets are funded by a devnet-only server route that mints test USDC; a real launch needs fee sponsorship, a real on-ramp and an authenticated, rate-limited route.
- Off-chain side deals (cash on Venmo) can't be stopped by code.
- A seller and a buyer can still agree on a higher price in private, also onchain: one transaction that lists at face, buys, and sends extra money on the side, signed by both. The program stops public listings above face, not private deals.
- A resale that lands between the gate's read and the check-in transaction leaves the buyer with a used ticket. The gate refuses listed tickets to narrow this; closing it needs a program change (SPEC §7).
- New tickets are numbered by a counter, so buyers who click in the same second collide: one wins and the rest must retry. Fine for a demo, not for a real on-sale.
