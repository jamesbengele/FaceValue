# Email sign-in (Privy) and test funds

Email sign-in is optional and sits beside Phantom. Without an App ID the app is Phantom-only and shows
"Email sign-in isn't configured."

## 1. App ID
Create `app/.env.local` (git-ignored) and add:

```
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```
Restart `npm run dev` (the value is read at build/start time).

## 2. Privy dashboard settings
- Login methods: Email ON.
- Wallets: Embedded wallets ON, Solana enabled (the app creates one for every user on login).
- Allowed origins / domains: `http://localhost:3000` (add your deployed origin later).

## 3. Test-fund route (`POST /api/drip`, devnet only)
Email wallets start with no SOL and no token account, so the app calls `/api/drip` right after sign-in
(Phantom users get a "Get test funds" button). Server env vars, in `app/.env.local`:

| Var | Meaning |
|---|---|
| `DEMO_MINT` | the test mint (required; the route refuses without it). Its mint authority must be the drip key. |
| `DRIP_KEYPAIR_JSON` | secret key as a JSON array. If unset, the key is read from the file at `DEPLOYER_KEYPAIR` |
| `DEPLOYER_KEYPAIR` | path to that keypair file, default `../.keys/deployer.json` |
| `NEXT_PUBLIC_RPC_URL` | optional, default devnet |

Behaviour: sends 0.03 SOL if the wallet has under 0.02 SOL; creates the token account if missing and mints
200 test USDC if its balance is under 50. 60 s cooldown per address (in memory). The drip wallet needs devnet SOL.
Not for production: see the comment at the top of `src/app/api/drip/route.ts`.
