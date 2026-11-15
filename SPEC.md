# SPEC.md — FaceValue (UBC rebuild)

> Student tickets that can never be resold above face value. The rule lives in the ticket itself, not in a company's terms of service.

**Chain:** Solana devnet. **Code written Nov 13–20, fresh from this spec.** This file is the source of truth: change it before the code.

## 1. The one thing a judge should remember

> **Try to resell a $50 ticket for $80 → the program rejects it during simulation and the wallet never asks you to sign. List it at $50 → it sells instantly.**

The rejection must come from the program. A price check in the frontend would make that claim false, so the app has none.

## 2. Why it needs a blockchain

The ticket is **not** a transferable token. It is an account owned by our program, and the **only** way to change its `owner` is `buy_resale`, which enforces the cap. Payment and ownership change happen in one atomic transaction.

## 3. What changed from the first build

| Idea | Design |
|---|---|
| **USDC, not SOL** | Prices and payments are SPL tokens (6 decimals, $50 = `50_000_000`). The mint is stored on the Event, not hardcoded, so tests and the demo use a mint we create; real USDC works unchanged. |
| **Organizer royalty** | `royalty_bps` on the Event (max 1000 = 10%). On a resale the royalty is taken **out of the seller's share**. The buyer pays exactly `ask_price`, which is at most face. |
| **Rotating gate QR** | Offchain, no program change (§7). |
| **Email sign-in** | Privy embedded Solana wallet, added beside Phantom (§8). |

## 4. Program (Anchor, single file `program/src/lib.rs`)

Only `anchor-lang` and `anchor-spl` (classic `token` program). Token accounts are `Account<TokenAccount>`; use `Program<'info, Token>` only.

```rust
#[account] #[derive(InitSpace)]
pub struct Event {
    pub organizer: Pubkey,
    pub event_id: u64,
    #[max_len(32)] pub name: String,
    pub mint: Pubkey,        // payment token
    pub treasury: Pubkey,    // organizer's token account for `mint`
    pub face_price: u64,     // token base units
    pub royalty_bps: u16,    // <= 1000
    pub max_supply: u32,
    pub sold: u32,           // also the next ticket_id
    pub bump: u8,
}
#[account] #[derive(InitSpace)]
pub struct Ticket {
    pub event: Pubkey, pub ticket_id: u32, pub owner: Pubkey,
    pub listed: bool, pub ask_price: u64, pub used: bool, pub bump: u8,
}
```

PDAs: Event `["event", organizer, event_id.to_le_bytes()]`; Ticket `["ticket", event, ticket_id.to_le_bytes()]` (`ticket_id = event.sold` when bought).

| # | Instruction | Signer | Does | Must fail when |
|---|---|---|---|---|
| 1 | `create_event(event_id, name, face_price, royalty_bps, max_supply)` | organizer | Creates Event; `treasury` must be a token account of `mint` owned by the organizer | name > 32 → `NameTooLong` · face_price = 0 → `InvalidPrice` · max_supply = 0 → `InvalidSupply` · royalty_bps > 1000 → `InvalidRoyalty` · treasury wrong mint/owner → `InvalidTokenAccount` |
| 2 | `buy_ticket()` | buyer | Transfers `face_price` buyer_token → treasury, creates Ticket (`owner = buyer`), `sold += 1`. Buyer pays the ticket account's rent in SOL | `sold == max_supply` → `SoldOut` · buyer_token wrong mint/owner, treasury ≠ `event.treasury` → `InvalidTokenAccount` |
| 3 | `list_ticket(price)` | owner | `listed = true`, `ask_price = price` | **`price > face_price` → `PriceAboveFace`** · signer ≠ owner → `NotOwner` · used → `TicketUsed` · price = 0 → `InvalidPrice` |
| 4 | `cancel_listing()` | owner | `listed = false`, `ask_price = 0` | signer ≠ owner → `NotOwner` |
| 5 | `buy_resale(max_price)` | buyer | Atomically: `royalty = ask * royalty_bps / 10_000` (floor, checked math); buyer_token → treasury `royalty`; buyer_token → seller_token `ask − royalty`; `owner = buyer`, `listed = false`, `ask_price = 0` | not listed → `NotListed` · buyer == owner → `CannotBuyOwnTicket` · used → `TicketUsed` · `ask_price > max_price` → `PriceChanged` · `ask_price > face_price` → `PriceAboveFace` (belt and suspenders) · seller_token not (mint = `event.mint`, owner = `ticket.owner`), buyer_token wrong, or treasury ≠ `event.treasury` → `InvalidTokenAccount` |
| 6 | `check_in()` | organizer | `used = true`, `listed = false` | signer ≠ `event.organizer` → `NotOrganizer` · used → `TicketUsed` |

**The cap:** `require!(price <= ctx.accounts.event.face_price, FaceValueError::PriceAboveFace);`

**Invariant:** in `buy_resale` the buyer's token balance falls by exactly `ask_price ≤ face_price`. The royalty is never added on top.

Errors: `PriceAboveFace, SoldOut, NotOwner, NotOrganizer, NotListed, TicketUsed, CannotBuyOwnTicket, InvalidPrice, NameTooLong, InvalidSupply, PriceChanged, InvalidRoyalty, InvalidTokenAccount, MathOverflow`.

Deployed: devnet `2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G`, built in Solana Playground (Anchor 0.29, old-format IDL, so no `ctx.bumps`; bumps come from `find_program_address`).

### Tests (TypeScript, run against devnet; mocha)
Tests create their own mint, fund wallets by SOL transfer from the deployer, and never call `requestAirdrop`. RPC and wallet come from env. Same `declare_id!` locally and on devnet.
1. create_event → Event matches inputs (incl. mint, treasury, royalty)
2. A buys → A owns, treasury +face, A token −face, `sold == 1`
3. **A lists above face → `PriceAboveFace`**
4. A lists at face → listed
5. B names its own token account as the seller's → `InvalidTokenAccount`; `max_price` below ask → `PriceChanged`; B buys resale → B owns; **B's balance falls by exactly the ask; seller +ask−royalty; treasury +royalty; the three deltas add up**
6. A (no longer owner) lists → `NotOwner`
7. A checks in → `NotOrganizer`; organizer checks in B's ticket → used; B lists → `TicketUsed`
8. Buying past `max_supply` → `SoldOut`
9. `royalty_bps` 1001 → `InvalidRoyalty`; wrong-mint buyer account → `InvalidTokenAccount`
10. Royalty rounding: ask where `ask*bps` isn't a multiple of 10_000 → royalty floored, seller gets the rest, total = ask

## 5. App (Next.js App Router, devnet)

`@coral-xyz/anchor` with the committed IDL; `@solana/wallet-adapter-react` + Phantom; Privy for email (§8). One page, three sections: **Event card** (face price, X of Y sold, Buy), **My tickets** (status pill, price input pre-filled with face, List / Cancel listing, **Show gate code**), **Resale market** (price, seller, Buy, "Face value $50 · Max resale $50" badge). `?organizer=1`: Create event form, tickets list with **Check in**, and the gate scanner (§7).

- **No price validation in the frontend.** Transactions are simulated; a `PriceAboveFace` simulation error shows the red banner: "🚫 **Blocked by the ticket itself.** Resale price can't exceed face value ($50). This rule is enforced onchain." The wallet is never asked to sign.
- **Finding events and tickets:** fetch with Anchor's `account.all()` (discriminator filter only; no byte-size or field-offset `memcmp`), filter in JS. A fetch or decode failure shows its own error; "No event yet" appears only when the fetch succeeded and returned nothing.
- Every success toast links to Solana Explorer (`?cluster=devnet`). Dark premium look, violet → pink → amber gradient, base font ≥ 18px.
- USDC amounts shown as `$` with 2 decimals.

## 6. Demo (90 s, three Chrome windows: seller, buyer, organizer) — see `docs/DEMO.md`
Buy ($50) → list at $80 blocked → list at $50 → buyer buys (seller gets $50 minus royalty, one transaction) → seller shows gate code → organizer pastes it → check-in → Used.

## 7. Rotating gate QR (no program change)
1. Holder's page asks the wallet to `signMessage` **once**: `FaceValue gate session\nticket:<pda>\nkey:<ephemeral pubkey>\nexpires:<unix>\norigin:<page origin>`, valid 15 min.
2. An ephemeral ed25519 key (tweetnacl, memory only) signs `ticket:<pda>.window:<floor(unix/30)>` every 30 s; the QR/text code is base64url JSON `{t, w, k, e, s, n, g}` (ticket, wallet, ephemeral key, expiry, wallet sig, window, ephemeral sig) and refreshes each window.
3. The gate (organizer page) accepts a camera scan (BarcodeDetector if the browser has it) **or pasted text**. It verifies both signatures, `e` unexpired, `n` within ±1 window of now, the origin, then **re-fetches the ticket onchain**: `ticket.owner == w`, not used, ticket belongs to this organizer's event. Only then it sends `check_in`.
Limit, stated plainly: a code is valid for under ~90 s and can be forwarded live to a stranger; it defeats screenshots, not a holder who cooperates in real time.

## 8. Email sign-in (Privy)
`@privy-io/react-auth` with `loginMethods: ['wallet','email']`, `embeddedWallets.solana createOnLogin: 'all-users'`. Needs `NEXT_PUBLIC_PRIVY_APP_ID` (user creates the Privy app). Email wallets need SOL for rent/fees, a USDC token account and test USDC: a devnet-only `/api/drip` route (server key from env) sends a small SOL top-up and mints test USDC when the wallet is below a threshold. A real launch needs fee sponsorship (a paymaster/relayer), real USDC via on-ramp, and auth/rate-limits on that route.

## 9. Out of scope
Per-wallet limits, cap above face, event list page, multiple events.

## 10. Repo layout
```
SPEC.md  README.md  PROMPTS.md  docs/{DEMO,PITCH}.md
program/  src/lib.rs  tests/  Cargo.toml     idl/facevalue.json     app/
```
