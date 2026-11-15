# PROMPTS.md

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
- Program deployed from Playground wallet to devnet (program id 2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G, 314,448 bytes). Public-RPC rate limits made the upload take about 25 min.
- `mocha` suite against devnet: 10 passing (incl. test 3 PriceAboveFace, test 5 exact-ask split, test 10 rounding).
- Demo event created on devnet: mint AsTAYEnPr1vnwSUY1UiZuuS2fSw7F6qN3BUHNUGtUQw1, event HGzK3Z4JAppGLFrKAEDM7g2gUKp7AXVyPLukqcsFr6iK.
