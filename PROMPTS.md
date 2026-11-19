# PROMPTS.md

Current state, newer than the early entries below (which describe the first builds): program `9gCTdqdJtobM3NxVt262EyfvcrAKmqy7NSaSwpRLRkg2`, gate codes rotate every 10 s, email sign-in only (no Phantom), 18 devnet test cases.

Every prompt sent to a subagent, and what broke. Subagents run on Sonnet 5.5.

## 1. Program + tests (USDC, royalty)
Brief: write `program/src/lib.rs` and `program/tests/` from SPEC §4; no frontend, no Playground.
What broke / was corrected:
- First brief said Anchor 0.29-0.31 and told the agent to use `ctx.bumps.<name>`. Playground actually builds Anchor 0.29.0 (old-format IDL, checked by building the starter and reading the stored IDL), where `ctx.bumps` is a map. Sent a correction: use `find_program_address` for bumps, client `@coral-xyz/anchor` 0.29.0.
- Local `cargo build-sbf` is impossible on this machine: no MSVC build tools and no MinGW `gcc`, so host build scripts fail to link. All builds go through Playground.

## 2. App core (Sonnet)
Brief: Next.js app per SPEC §5 (Phantom, buy/list/cancel/resale, red banner via simulation only, organizer create/check-in, `account.all()` discovery, setup-demo and fund-wallet scripts). Explicit rule: no frontend price check. Outcome: see below once returned.
Outcome: app builds. Review found one bug: `\b` inside a template-literal RegExp in `errors.ts` was a backspace char, so name matching never fired (the Custom-code fallback masked it). Fixed to `\b`. Simulation-then-sign flow in `tx.ts` checked by reading: no price check in the frontend.

## 3. Rotating gate code (same subagent, resumed)
Brief: SPEC §7: gate.ts pure functions, signMessage in the wallet seam, holder QR/code with 30 s rotation, organizer gate (paste + BarcodeDetector), onchain re-fetch before check_in, node:assert tests. Outcome: build and `test:gate` pass; reviewed gate.ts and Gate.tsx by reading, no defects found. Phantom signMessage and camera unverified.

## Verification log
- Program deployed from Playground wallet to devnet (first program id 2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G, 314,448 bytes; later redeployed as 9gCTdqdJtobM3NxVt262EyfvcrAKmqy7NSaSwpRLRkg2, the id the app now uses). Public-RPC rate limits made the upload take about 25 min.
- `mocha` suite against devnet: 10 passing (incl. test 3 PriceAboveFace, test 5 exact-ask split, test 10 rounding).
- Demo event created on devnet: mint AsTAYEnPr1vnwSUY1UiZuuS2fSw7F6qN3BUHNUGtUQw1, event HGzK3Z4JAppGLFrKAEDM7g2gUKp7AXVyPLukqcsFr6iK.

## 4. Email sign-in (same subagent, resumed)
Brief: Privy beside Phantom, env-gated on NEXT_PUBLIC_PRIVY_APP_ID, plugged into the `useAppWallet` seam, devnet-only `/api/drip`, README-email. Outcome: build passes with and without an App ID. What broke: the subagent truncated App.tsx mid-task and restored it from git, re-applying only its edits; Privy's optional peer deps need `--legacy-peer-deps` (added an app/.npmrc). Reviewed drip route by reading. No Privy flow run (no App ID).

## 5. Audit fixes
Brief: apply the 17-item audit of Nov 16 (commit 7e87e97) in ten ordered groups, one commit per group; no program or IDL changes (Group 10 needs a redeploy and was not started).
What broke / was corrected:
- Auto mode blocked stopping the `next dev` server on port 3000 (needed before `npm run build`); it ran until James approved it in the thread.
- `README.md` line 8 first came out with a duplicated "Next.js app." after the IDL path edit; fixed before committing.
- Not verified: the Privy confirm prompt (Group 7), and every email-signed-in flow in the app.

## 6. Later feature rounds (PRs 1-14 and after)
Briefs: account balance, usernames (Redis store on Vercel), multi-event and my-events, fan loyalty and perks (`set_perks`), event details, buy up to 4 tickets, sold-out/ended states, phone-scannable `/check` QR with 10 s codes, landing page, hide events priced in old test tokens.
What broke / was corrected:
- The deployed program lagged the app (no perks yet), so a presale-address fallback was added to make Buy work, then dropped once the redeploy had perks.
- Old events priced in earlier test tokens showed up in the list; they are now hidden and the no-token buy error is clearer.
- Usernames wrote to local disk and failed on Vercel; moved to Redis with a /tmp fallback.

## 7. Pre-submission review fixes (Nov 19)
Brief: apply a ranked review before the demo. Gifting is hidden in the UI (the program still has `transfer_ticket`) and covered by a Q&A answer; the pitch says "once we lock upgrades"; `/api/drip` got a global hourly cap; docs now match the app (phone QR scan in DEMO, one-line pitch and Explorer link in README).
Not verified: the drip cap under load, and a build with these edits (dev server was running).
