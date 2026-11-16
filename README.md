# FaceValue (UBC rebuild)

Student tickets that can't be resold above face value, enforced by the Solana program itself. Spec: [SPEC.md](SPEC.md). Demo script: [docs/DEMO.md](docs/DEMO.md). Prompt log: [PROMPTS.md](PROMPTS.md).

Features: USDC-style SPL token payments, organizer royalty on resales, rotating gate code (no camera needed), email sign-in (Privy).

## Layout
`program/` Anchor program (`src/lib.rs`) and devnet tests · `idl/facevalue.json` · `app/` Next.js app.

## Deployed
Devnet program `2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G`. Test mint `AsTAYEnPr1vnwSUY1UiZuuS2fSw7F6qN3BUHNUGtUQw1` (our own, deployer is mint authority).

## Deploy your own copy (Solana Playground, Anchor 0.29)
Local `cargo build-sbf` needs a C linker (MSVC build tools); on a machine with one it can be used instead.
1. beta.solpg.io: new Anchor project, paste `program/src/lib.rs`, connect the Playground wallet, fund it with devnet SOL (the faucet needs a human: faucet.solana.com).
2. Build (Playground rewrites `declare_id!`; copy that line back into the repo and into `program/tests/helpers.ts`), then Deploy. Over the public RPC this took ~25 min for 314 KB.
3. Replace `idl/facevalue.json` and `app/src/idl/facevalue.json` with the IDL Playground produced.

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
npm run setup-demo           # creates a test mint (+ a sample event); copy the mint into app/.env.local as DEMO_MINT
npm run fund-wallet -- <address> 200    # mint test USDC to a wallet's token account
npm run dev                  # http://localhost:3000   (organizer view: ?organizer=1)
```
`app/.env.local`: `DEMO_MINT` (used by `/api/drip`), optional `NEXT_PUBLIC_EVENT_ADDRESS` to pin one event, optional `NEXT_PUBLIC_PRIVY_APP_ID` for email sign-in ([app/README-email.md](app/README-email.md)). Wallets need a little devnet SOL for ticket-account rent and fees.

## Limits to know
- Gate codes last under ~90 s and defeat screenshots, not a holder forwarding a live code.
- Email wallets are funded by a devnet-only server route that mints test USDC; a real launch needs fee sponsorship, a real on-ramp and an authenticated, rate-limited route.
- Off-chain side deals (cash on Venmo) can't be stopped by code.
