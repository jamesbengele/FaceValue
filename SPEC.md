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

Deployed: devnet `9gCTdqdJtobM3NxVt262EyfvcrAKmqy7NSaSwpRLRkg2`, built in Solana Playground (Anchor 0.29, old-format IDL, so no `ctx.bumps`; bumps come from `find_program_address`).

### 4b. Fan loyalty: presale and discount ("bots can buy tickets; they can't fake showing up")

A checked-in ticket is proof of attendance: `check_in` is organizer-only and a used ticket can't be listed or resold. The program counts it per **(organizer, fan)** and lets an organizer give fans with enough check-ins at its earlier events two **fan perks** per event: a **fans-only presale window** and a **discount on one ticket**.

```rust
#[account] #[derive(InitSpace)]
pub struct FanPass { organizer: Pubkey, fan: Pubkey, attended: u32, last_event: Pubkey, bump: u8 } // seeds ["fan", organizer, fan]
#[account] #[derive(InitSpace)]
pub struct Perks { event: Pubkey, presale_ends_at: i64, min_attended: u32, discount_bps: u16, bump: u8 } // seeds ["perks", event]
// discount receipt: 0-byte program-owned account, seeds ["discount", event, buyer]; exists once that buyer used the discount
```

| # | Instruction | Signer | Effect | Rejects |
|---|---|---|---|---|
| 2' | `buy_ticket()` + accounts `perks`, `fan_pass` (seeds-checked, may not exist), `discount` (mut, seeds-checked) | buyer | If Perks exist: a *fan* has a FanPass with `attended >= min_attended`. While `now < presale_ends_at` only fans may buy. If `discount_bps > 0`, the buyer is a fan and has no discount receipt for this event: pays `face − floor(face × bps / 10_000)` and the receipt is created (buyer pays its rent). Everyone else pays face | presale and not a fan → `PresaleFansOnly` |
| 6' | `check_in(expected_owner)` + accounts `fan_pass` (mut, seeds `["fan", event.organizer, ticket.owner]`), `system_program`; `organizer` becomes `mut` (pays the FanPass rent) | organizer | Creates the FanPass on a fan's first check-in (transfer/allocate/assign, so a pre-funded address can't block it). `attended += 1` only if `last_event != event` (several tickets at one event count once), then `last_event = event` | as before |
| 7 | `set_perks(presale_ends_at, min_attended, discount_bps)` | organizer | Creates Perks for an event. `presale_ends_at = 0`: no presale; `discount_bps = 0`: no discount | signer ≠ organizer → `NotOrganizer` · `sold > 0` → `SalesStarted` · `min_attended == 0`, `discount_bps > 5000`, `presale_ends_at` neither 0 nor in the future, or both perks off → `InvalidPerks` |

- **Backward compatible:** `Event` and `Ticket` are unchanged, and the new accounts are appended at the end of `BuyTicket` and `CheckIn`, so the deployed (old) program ignores them as remaining accounts. The updated app keeps working before the redeploy; only `set_perks` needs the new program.
- New errors are appended after `MathOverflow`: `PresaleFansOnly, SalesStarted, InvalidPerks` (in the slot PR 5 had for `InvalidPresale`, so later codes keep their numbers), then `OwnerChanged, EventHasTickets` (the upgrade in §11).
- **Why one discounted ticket per fan per event:** resale is capped at face, not at what the buyer paid, so unlimited discounted tickets would let a fan buy at $45 and resell at $50. The receipt limits that to one ticket.
- Known limits: the presale doesn't cap tickets per fan (resale stays capped at face); a fan can still resell their one discounted ticket at face.

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
12. Presale: non-organizer → `NotOrganizer`; `min_attended` 0 → `InvalidPerks`; C (no FanPass) buys during the window → `PresaleFansOnly`; B (attended 2) buys; `set_perks` after a sale → `SalesStarted`
13. Discount: 5001 bps or both perks off → `InvalidPerks`; with 10% for 2+ check-ins B pays 90% of face (treasury +90%) and the receipt exists; B's second ticket costs face; C (no check-ins) pays face

15. Event info: non-organizer → `NotOrganizer`, organizer sets it and it reads back; owner gifts a ticket (owner changes), non-owner → `NotOwner`

## 5. App (Next.js App Router, devnet)

`@coral-xyz/anchor` with the committed IDL; `@solana/wallet-adapter-react` (ConnectionProvider only); Privy email sign-in is the only login (§8). A sidebar with four views. **Events**: a list of every event on the program (soonest first; each shows name, date and time, face price, X of Y sold); opening one shows the event detail with **Buy** and its **Resale market** (price, seller, Buy, "Face value $50 · Max resale $50" badge). **My tickets**: the signed-in wallet's tickets across all events (event name and date, status pill, price input pre-filled with the event's face price, List / Cancel listing, **Show gate code**). **My events**: the events the signed-in wallet organizes (pick one): sales overview, buyer link, **Delete event** while nothing is sold, its tickets with **Check in**, and the gate scanner (§7). **Host**: the Create event form (name, date and time, face price, royalty, supply, mint, optional details and fan perks). `?event=<address>` opens that event's detail; `?organizer=1` opens Host.

- **No price validation in the frontend.** Transactions are simulated; a `PriceAboveFace` simulation error shows the red banner: "🚫 **Blocked by the ticket itself.** Resale price can't exceed face value ($50). This rule is enforced onchain." The wallet is never asked to sign.
- **Finding events and tickets:** fetch with Anchor's `account.all()` (discriminator filter only; no byte-size or field-offset `memcmp`), filter in JS. A fetch or decode failure shows its own error; "No event yet" appears only when the fetch succeeded and returned nothing. Event lists show all events on the program, including other runs' test events; use `?event=<address>` (or `NEXT_PUBLIC_EVENT_ADDRESS`, which opens that event's detail first) to go straight to one. Host shows only events whose `organizer` is the signed-in wallet, newest selected first, and the gate check stays tied to the event selected there.
- **Date and time:** the Event account has no date field and the deployed program is unchanged, so the start time is stored in the onchain `name` as `<name>|<minutes since epoch, base36>` and parsed for display. This leaves about 25 characters for the name when a date is set (the program caps the name at 32 bytes). A name without the suffix shows "Date to be announced". Proper fix, if wanted later: a `starts_at` field in `Event` (program change and redeploy).
- **Grouped by price:** the Resale market shows one row per price, cheapest first ("$45.00 · 3 available · Buy 1"). Buy takes the first ticket at that price; if another buyer got it first, the app tries the next one at the same price. My tickets groups by event, and within an event identical tickets share one row ("2 tickets · Owned", "2 tickets · Listed at $50 each", "1 ticket · Used"): list N of them at one price (default all) or cancel N of those listings (default 1), each in one transaction (up to 10), and the gate codes, one per ticket, open under "Show gate codes".
- **Fan record:** event detail and My tickets show the signed-in wallet's check-ins with that organizer, read from its FanPass. Events with perks show badges ("Fans-only presale until <time>", "10% off for fans"); the event detail shows whether the user qualifies and, for an unused discount, the fan price on the Buy button (display only; the program computes the charge). Create event has optional presale minutes, discount % and minimum check-ins, sent as `set_perks` in the same transaction.
- **Hide event (this device only):** each event card on Events has a Hide button. Hidden ids are kept in localStorage; "Show hidden (n)" brings them back. It changes nothing onchain and is for other organizers' old test events, which no one but their organizer can delete.
- **Delete event:** Host, for the selected event, shows **Delete event** only when `sold == 0` (with a confirm step). It sends `close_event` and the organizer gets the rent back. An event with sold tickets can't be deleted, so a holder never loses a ticket; the Host view says so. Needs the §11 upgrade.
- **Usernames (off-chain, no program change):** a username is **required**: after sign-in a wallet with no username sees only a "Pick a username" screen (3 to 20 characters: lowercase letters, digits, underscore) and cannot use the rest of the app until it saves one (sign out stays available). If the lookup itself fails (the names server is unreachable) the app is not blocked. The app signs the message `FaceValue username: <name>` with the wallet (`signMessage`) and POSTs `{address, username, signature}` to `/api/username`, which checks the signature (ed25519) and stores `address → username` in a JSON file on the app server (`USERNAMES_FILE`, default `app/.data/usernames.json`, gitignored; names are unique, case-insensitive, and a wallet can change its own). `GET /api/username?addresses=a,b` returns the names for those wallets. The event detail shows **Created by <username>** (the wallet's short address as well, or the short address alone if it has none). Limits: the store lives on one server, so it works for the demo on one machine but not on a serverless host, and it is not part of the ticket data on chain.
- **App icon:** `app/public/icons/icon-{180,192,512}.png` (flat off-white "F" on the page's dark background `#0b0a12`, matching the plain look and the off-white primary button; no gradient) are used by the manifest and the iPhone home-screen icon. Plain PNGs, drawn once with Inter ExtraBold at 62% of the icon height (full-bleed square, the OS rounds the corners); `next/og` was not used because it crashes the dev server on Windows paths containing spaces.
- Every success toast links to Solana Explorer (`?cluster=devnet`). Plain look: one filled button per screen (the main action), outlined buttons elsewhere, a plain wordmark, no gradients or emoji, thin dividers instead of nested cards; light and dark themes; base font ≥ 18px. Wallet, balance, test funds and sign-out live in an account menu; success notices fade on their own, errors stay until dismissed.
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

**Balance:** the signed-in header shows `SOL x.xxxx · $yyy.yy` (SOL plus the largest balance among the payment tokens the listed events use, so it does not change when an event is opened; none held is $0.00). It refreshes on sign-in, with the 15 s poll, after every transaction and after Get test funds; on RPC failure it shows "Balance unavailable".
**Theme:** light and dark modes follow the OS setting, with a header toggle saved in localStorage. The active nav item (sidebar and phone tab bar) has a subtle filled background.
**Search:** the Events list has a client-side "Search events" box (case-insensitive match on name and date text).

## 9. Out of scope
Deleting an event that has sold tickets, and deleting events of other organizers; per-wallet limits (including during the presale), a resale cap at the price paid, loyalty shared across organizers, cap above face, event search or filters, a date field in the program.

## 10. Repo layout
```
SPEC.md  README.md  PROMPTS.md  docs/{DEMO,PITCH}.md
program/  src/lib.rs  tests/  package.json     app/  src/idl/facevalue.json   (no Cargo.toml: built in Playground)
```

## 11. Program upgrade: check-in guard and event delete
One upgrade to the existing program ID, **account layouts unchanged** (existing events and tickets keep working):
- `check_in(expected_owner: Pubkey)` fails with `OwnerChanged` if the ticket's owner changed since the gate verified it.
- `close_event()` (§3 row 8): organizer-only, only while `sold == 0`. An early-access window account (`perks`) the event may have is not closed and stays as a small orphan. Event ids are timestamps, so it is never reused.
- Not included: removing the unused `bump` fields. It would change every account's size and decoding for 1 byte each, for no behaviour.
- The same upgrade also deploys the loyalty code of §4b (`set_perks`, `FanPass`), which was committed but not yet deployed. The app keeps the old `check_in()` call until the upgrade is live; then Gate drops the listed-ticket refusal.
