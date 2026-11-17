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
| **Email sign-in** | Privy embedded Solana wallet; the only sign-in method (§8). |

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
| 6 | `check_in(expected_owner)` | organizer | `used = true`, `listed = false` | signer ≠ `event.organizer` → `NotOrganizer` · used → `TicketUsed` · `ticket.owner ≠ expected_owner` → `OwnerChanged` (the owner the gate verified; see §7) |
| 8 | `close_event()` | organizer | Closes the Event account and returns its rent to the organizer | signer ≠ `event.organizer` → `NotOrganizer` · `sold > 0` → `EventHasTickets` |

**The cap:** `require!(price <= ctx.accounts.event.face_price, FaceValueError::PriceAboveFace);`

**Invariant:** in `buy_resale` the buyer's token balance falls by exactly `ask_price ≤ face_price`. The royalty is never added on top.

Errors: `PriceAboveFace, SoldOut, NotOwner, NotOrganizer, NotListed, TicketUsed, CannotBuyOwnTicket, InvalidPrice, NameTooLong, InvalidSupply, PriceChanged, InvalidRoyalty, InvalidTokenAccount, MathOverflow`.

Deployed: devnet `2NXBG5xSwYk89Z1iBN8YhKMjrX2WKXCxhBUbXLxRJz6G`, built in Solana Playground (Anchor 0.29, old-format IDL, so no `ctx.bumps`; bumps come from `find_program_address`).

### 4b. Fan loyalty and early access ("bots can buy tickets; they can't fake showing up")

A checked-in ticket is proof of attendance: `check_in` is organizer-only and a used ticket can't be listed or resold. The program counts it per **(organizer, fan)** and lets an organizer give an **early-access window** to fans with enough check-ins at its earlier events.

```rust
#[account] #[derive(InitSpace)]
pub struct FanPass { organizer: Pubkey, fan: Pubkey, attended: u32, last_event: Pubkey, bump: u8 } // seeds ["fan", organizer, fan]
#[account] #[derive(InitSpace)]
pub struct Presale { event: Pubkey, ends_at: i64, min_attended: u32, bump: u8 }                 // seeds ["presale", event]
```

| # | Instruction | Signer | Effect | Rejects |
|---|---|---|---|---|
| 2' | `buy_ticket()` + accounts `presale`, `fan_pass` (seeds-checked, may not exist) | buyer | If a Presale exists and `now < ends_at`: the buyer's FanPass must exist with `attended >= min_attended` | otherwise → `PresaleFansOnly` |
| 6' | `check_in(expected_owner)` + accounts `fan_pass` (mut, seeds `["fan", event.organizer, ticket.owner]`), `system_program`; `organizer` becomes `mut` (pays the FanPass rent) | organizer | Creates the FanPass on a fan's first check-in (transfer/allocate/assign, so a pre-funded address can't block it). `attended += 1` only if `last_event != event` (several tickets at one event count once), then `last_event = event` | as before |
| 7 | `set_presale(ends_at, min_attended)` | organizer | Creates Presale for an event | signer ≠ organizer → `NotOrganizer` · `sold > 0` → `SalesStarted` · `min_attended == 0` or `ends_at <= now` → `InvalidPresale` |

- **Backward compatible:** `Event` and `Ticket` are unchanged, and the new accounts are appended at the end of `BuyTicket` and `CheckIn`, so the deployed (old) program ignores them as remaining accounts. The updated app keeps working before the redeploy; only `set_presale` needs the new program.
- New errors are appended after `MathOverflow`: `PresaleFansOnly, SalesStarted, InvalidPresale`, then `OwnerChanged, EventHasTickets` (the upgrade in §11).
- Known limits: early access doesn't cap tickets per fan; a fan who resells a presale ticket is still capped at face.

### 4c. Event details and gifting (additive, same upgrade as `close_event`)

```rust
#[account] #[derive(InitSpace)]
pub struct EventInfo { event: Pubkey, starts_at: i64, #[max_len(64)] venue: String, #[max_len(400)] description: String, #[max_len(200)] image_url: String, bump: u8 } // seeds ["info", event]
```
| # | Instruction | Signer | Effect | Rejects |
|---|---|---|---|---|
| 8 | `set_event_info(starts_at, venue, description, image_url)` | organizer | Creates EventInfo once (unix start time, venue, text, image link). Optional; events without one keep the date-in-name fallback (§5) | signer ≠ organizer → `NotOrganizer` · over-length or `starts_at <= 0` → `InvalidEventInfo` |
| 9 | `transfer_ticket()` + `new_owner` | owner | Gift: `owner = new_owner`. No payment, so no price to cap. A resale is still the only way money changes hands | not owner → `NotOwner` · used → `TicketUsed` · listed → `TicketListed` · to self → `CannotBuyOwnTicket` |
- New errors appended: `InvalidEventInfo, TicketListed`. `Event` and `Ticket` unchanged, so old events keep working.
- Known limit: a gift can't be undone and a ticket can be passed on freely, which is the point (no markup possible, nobody is paid).

### Tests (TypeScript, run against devnet; mocha)
Tests create their own mint, fund wallets by SOL transfer from the deployer, and never call `requestAirdrop`. RPC and wallet come from env. `declare_id!` is the ID Playground assigns on build; keep it in sync with the tests.
1. create_event → Event matches inputs (incl. mint, treasury, royalty)
2. A buys → A owns, treasury +face, A token −face, `sold == 1`
3. **A lists above face → `PriceAboveFace`**; listing above face by naming a pricier event of the same organizer → `ConstraintHasOne`
4. A lists at face → listed; `cancel_listing`: non-owner → `NotOwner`, owner cancels (`listed = false`, `ask_price = 0`), then relists at face
5. B names its own token account as the seller's → `InvalidTokenAccount`; `max_price` below ask → `PriceChanged`; B buys resale → B owns; **B's balance falls by exactly the ask; seller +ask−royalty; treasury +royalty; the three deltas add up**
6. A (no longer owner) lists → `NotOwner`
7. A checks in → `NotOrganizer`; organizer checks in B's ticket → used; B lists → `TicketUsed`
8. Buying past `max_supply` → `SoldOut`
9. `royalty_bps` 1001 → `InvalidRoyalty`; wrong-mint buyer account → `InvalidTokenAccount`; a buyer naming its own account as the treasury → `InvalidTokenAccount`
10. Royalty rounding: ask where `ask*bps` isn't a multiple of 10_000 → royalty floored, seller gets the rest, total = ask
11. Fan pass: test 7's check-in created B's FanPass with `attended == 1`; a second ticket of B's at the same event checked in → still 1; a check-in at another event of the organizer → 2
12. Presale: non-organizer → `NotOrganizer`; `min_attended` 0 → `InvalidPresale`; C (no FanPass) buys during the window → `PresaleFansOnly`; B (attended 2) buys; `set_presale` after a sale → `SalesStarted`

15. Event info: non-organizer → `NotOrganizer`, organizer sets it and it reads back; owner gifts a ticket (owner changes), non-owner → `NotOwner`

## 5. App (Next.js App Router, devnet)

`@coral-xyz/anchor` with the committed IDL; `@solana/wallet-adapter-react` (ConnectionProvider only); Privy email sign-in is the only login (§8). A sidebar with three views. **Events**: a list of every event on the program (soonest first; each shows name, date and time, face price, X of Y sold); opening one shows the event detail with **Buy** and its **Resale market** (price, seller, Buy, "Face value $50 · Max resale $50" badge). **My tickets**: the signed-in wallet's tickets across all events (event name and date, status pill, price input pre-filled with the event's face price, List / Cancel listing, **Show gate code**). **Host an event**: Create event form (name, date and time, face price, royalty, supply, mint), the organizer's own events (pick one), its tickets with **Check in**, and the gate scanner (§7). `?event=<address>` opens that event's detail; `?organizer=1` opens Host.

- **No price validation in the frontend.** Transactions are simulated; a `PriceAboveFace` simulation error shows the red banner: "🚫 **Blocked by the ticket itself.** Resale price can't exceed face value ($50). This rule is enforced onchain." The wallet is never asked to sign.
- **Finding events and tickets:** fetch with Anchor's `account.all()` (discriminator filter only; no byte-size or field-offset `memcmp`), filter in JS. A fetch or decode failure shows its own error; "No event yet" appears only when the fetch succeeded and returned nothing. Event lists show all events on the program, including other runs' test events; use `?event=<address>` (or `NEXT_PUBLIC_EVENT_ADDRESS`, which opens that event's detail first) to go straight to one. Host shows only events whose `organizer` is the signed-in wallet, newest selected first, and the gate check stays tied to the event selected there.
- **Date and time:** the Event account has no date field and the deployed program is unchanged, so the start time is stored in the onchain `name` as `<name>|<minutes since epoch, base36>` and parsed for display. This leaves about 25 characters for the name when a date is set (the program caps the name at 32 bytes). A name without the suffix shows "Date to be announced". Proper fix, if wanted later: a `starts_at` field in `Event` (program change and redeploy).
- **Grouped by price:** the Resale market shows one row per price, cheapest first ("$45.00 · 3 available · Buy 1"). Buy takes the first ticket at that price; if another buyer got it first, the app tries the next one at the same price. My tickets groups by event ("2 tickets"), and each ticket keeps its own gate code, listing and status.
- **Fan record:** event detail and My tickets show the signed-in wallet's check-ins with that organizer, read from its FanPass. During an event's early-access window the event shows "Early access for fans with N+ check-ins until <time>" and whether the user qualifies; the program enforces it. Create event has an optional early-access window (minutes) and minimum check-ins, sent as `set_presale` in the same transaction.
- **Hide event (this device only):** each event card on Events has a Hide button. Hidden ids are kept in localStorage; "Show hidden (n)" brings them back. It changes nothing onchain and is for other organizers' old test events, which no one but their organizer can delete.
- **Delete event:** Host, for the selected event, shows **Delete event** only when `sold == 0` (with a confirm step). It sends `close_event` and the organizer gets the rent back. An event with sold tickets can't be deleted, so a holder never loses a ticket; the Host view says so. Needs the §11 upgrade.
- **App icon:** `app/public/icons/icon-{180,192,512}.png` (white "F" on the violet → pink → amber gradient) are used by the manifest and the iPhone home-screen icon. Plain PNGs written once with a small node script (no dependency); `next/og` was not used because it crashes the dev server on Windows paths containing spaces.
- Every success toast links to Solana Explorer (`?cluster=devnet`). Dark premium look, violet → pink → amber gradient, base font ≥ 18px.
- USDC amounts shown as `$` with 2 decimals.

## 6. Demo (90 s, three Chrome windows: seller, buyer, organizer) — see `docs/DEMO.md`
Buy ($50) → list at $80 blocked → list at $50 → buyer buys (seller gets $50 minus royalty, one transaction) → seller shows gate code → organizer pastes it → check-in → Used.

## 7. Rotating gate QR (no program change)
1. Holder's page asks the wallet to `signMessage` **once**: `FaceValue gate session\nticket:<pda>\nkey:<ephemeral pubkey>\nexpires:<unix>\norigin:<page origin>`, valid 15 min.
2. An ephemeral ed25519 key (tweetnacl, memory only) signs `ticket:<pda>.window:<floor(unix/30)>` every 30 s; the QR/text code is base64url JSON `{t, w, k, e, s, n, g}` (ticket, wallet, ephemeral key, expiry, wallet sig, window, ephemeral sig) and refreshes each window.
3. The gate (organizer page) accepts a camera scan (BarcodeDetector if the browser has it) **or pasted text**. It verifies both signatures, `e` unexpired and at most 15 min ahead (plus 60 s for clock drift), `n` within ±1 window of now, the origin, then **re-fetches the ticket onchain**: `ticket.owner == w`, not used, not listed for resale, and the ticket's event is the one on the organizer's screen. Only then it sends `check_in`.
Limit, stated plainly: a code is valid for under ~90 s and can be forwarded live to a stranger; it defeats screenshots, not a holder who cooperates in real time.
The gate passes the verified wallet `w` to `check_in(expected_owner)`; if the ticket was resold in between, the program rejects it with `OwnerChanged` and the buyer keeps an unused ticket. A listed ticket can therefore be checked in (this also clears the listing). Until the program upgrade in §11 is live, the gate refuses listed tickets instead, which narrows the race but does not close it.

## 8. Email sign-in (Privy)
`@privy-io/react-auth` with `loginMethods: ['email']`, `embeddedWallets.solana createOnLogin: 'all-users'`. Needs `NEXT_PUBLIC_PRIVY_APP_ID` (user creates the Privy app). Email wallets need SOL for rent/fees, a USDC token account and test USDC: a devnet-only `/api/drip` route (server key from env) sends a small SOL top-up and mints test USDC when the wallet is below a threshold. A real launch needs fee sponsorship (a paymaster/relayer), real USDC via on-ramp, and auth/rate-limits on that route.
Wallet confirmation prompts stay on (`showWalletUIs: true`), so a successful buy asks the user to confirm and a blocked listing never does.

**Balance:** the signed-in header shows `SOL x.xxxx · $yyy.yy` (SOL plus the open event's payment-token balance; a missing token account is $0.00). It refreshes on sign-in, with the 15 s poll, after every transaction and after Get test funds; on RPC failure it shows "Balance unavailable".
**Theme:** light and dark modes follow the OS setting, with a header toggle saved in localStorage. The active nav item (sidebar and phone tab bar) is a filled gradient pill.
**Search:** the Events list has a client-side "Search events" box (case-insensitive match on name and date text).

## 9. Out of scope
Deleting an event that has sold tickets, and deleting events of other organizers; per-wallet limits (including during early access), discounts for fans, loyalty shared across organizers, cap above face, event search or filters, a date field in the program.

## 10. Repo layout
```
SPEC.md  README.md  PROMPTS.md  docs/{DEMO,PITCH}.md
program/  src/lib.rs  tests/  package.json     app/  src/idl/facevalue.json   (no Cargo.toml: built in Playground)
```

## 11. Program upgrade: check-in guard and event delete
One upgrade to the existing program ID, **account layouts unchanged** (existing events and tickets keep working):
- `check_in(expected_owner: Pubkey)` fails with `OwnerChanged` if the ticket's owner changed since the gate verified it.
- `close_event()` (§3 row 8): organizer-only, only while `sold == 0`. An early-access window account (`presale`) the event may have is not closed and stays as a small orphan. Event ids are timestamps, so it is never reused.
- Not included: removing the unused `bump` fields. It would change every account's size and decoding for 1 byte each, for no behaviour.
- The same upgrade also deploys the loyalty code of §4b (`set_presale`, `FanPass`), which was committed but not yet deployed. The app keeps the old `check_in()` call until the upgrade is live; then Gate drops the listed-ticket refusal.
