# DEMO.md: 90-second demo (three Chrome windows)

## Setup (before the meeting)
1. Three Chrome profiles, each with Phantom on **Devnet**: **Seller** (left), **Buyer** (middle), **Organizer** (right). Each needs ~0.1 devnet SOL (ticket rent and fees).
2. Give Seller and Buyer test USDC: `cd app && npm run fund-wallet -- <address> 200` for each. The organizer also needs a token account for the same mint (the Create event form makes it).
3. `cd app && npm run dev`. Open `http://localhost:3000` in Seller and Buyer, and `http://localhost:3000/?organizer=1` in Organizer.
4. Organizer: **Create event** with the test mint address (from `DEMO_MINT`), face $50, royalty 5%, supply 20. Reload the other two windows: they show the new event. Keep an Explorer tab open (devnet).

## Script
1. **(15 s) Seller:** Buy ticket, $50, approve. Ticket appears under My tickets. *"Alex got a student ticket at face value."*
2. **(20 s) Seller:** set the price to **80**, List for resale. Red banner: **Blocked by the ticket itself.** Phantom never opens. *"On StubHub this would list. Here, the ticket refuses."* Pause.
3. **(15 s) Seller:** list at **50**; it appears in Resale market.
4. **(20 s) Buyer:** Buy. Ticket moves; Seller gets $47.50, the organizer gets $2.50, one transaction. Open the Explorer link. *"Payment, royalty and ticket moved together."*
5. **(20 s) Buyer:** Show gate code (one Phantom signature). Organizer: paste the code into Gate, Verify & check in. Status: Used. *"A screenshot is useless a minute later."*

## Email sign-in (optional segment, needs a Privy App ID)
Open the app in a fresh profile, **Sign in with email**, enter the code, it auto-gets test funds. Buy a ticket with no wallet installed.

## Backup
Record a screen capture of the full run. If devnet is slow, play it and say so.
