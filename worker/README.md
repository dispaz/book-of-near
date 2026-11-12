# Book of NEAR Worker

A Cloudflare Worker. It runs the **testnet faucet** (issue #7) and the **1Click quote proxy** for lesson 4.2 (issue #24); the badge claim signer and exam grader come later.

## Routes

| Route | What it does |
| --- | --- |
| `POST /faucet` `{ publicKey, accountId? }` | Funds a learner's practice account with `FAUCET_AMOUNT` NEAR (default 0.5) from the faucet account. Without `accountId` it funds the implicit account of `publicKey` (64 hex characters). With `accountId: "name.testnet"` it creates that name through `testnet.create_account`. Returns `{ accountId, txHash, amount }`. |
| `POST /intents/quote` `{ dry, swapType, slippageTolerance, originAsset, depositType, destinationAsset, amount, refundTo, refundType, recipient, recipientType, deadline }` | Forwards a quote request to `https://1click.chaindefuser.com/v0/quote` and returns its answer and status. Only an `EXACT_INPUT` swap of `nep141:wrap.near` (NEAR) into USDC on Arbitrum; slippage 0 to 300 bps; deadline within the next 30 minutes; body at most 4 KB (413); unknown fields are dropped. A non-dry quote (a real swap) above 0.25 NEAR is refused with 400. With the optional `ONECLICK_JWT` secret it is sent as `Authorization: Bearer …` (the key never reaches the browser); without it 1Click still answers and adds an app fee. Checked against live 1Click with `wrangler dev` on 12 Nov 2026. |
| `POST /relay` `{ signedDelegate }` | Lesson 3.2's relayer (NEP-366 meta-transactions). `signedDelegate` is a base64 borsh `SignedDelegateAction` signed in the browser (at most 4 KB). The relayer account (`RELAYER_ACCOUNT_ID`, `RELAYER_PRIVATE_KEY`) wraps it in its own transaction with near-kit and pays the gas. Only contract calls with at most 1 yoctoNEAR attached each and at most 50 Tgas in all are sponsored (400 otherwise; the relayer would pay any deposit). Returns `{ txHash, relayerId, remaining, cap }`; 429 once the learner's account reached its daily cap. Unit-tested with a fake relayer; not yet run against testnet. |
| `GET /health` | `{ ok: true, faucet: <secrets configured?> }` |

Errors are JSON `{ error }` in plain English: 400 bad input, 403 origin not allowed, 409 account exists, 429 daily limit, 502 testnet unreachable, 503 no secrets set.

## Limits (cannot be drained from one address)

- `PER_IP_DAILY` accounts per IP address per UTC day (default 3), keyed on `cf-connecting-ip`.
- `GLOBAL_DAILY` accounts per UTC day in total (default 50, so at most 25 NEAR a day at 0.5 NEAR).
- `QUOTE_PER_IP_DAILY` / `QUOTE_GLOBAL_DAILY`: 1Click quotes per IP address and in total per UTC day (defaults 20 and 400), counted apart from the faucet under a `quote:` key prefix.
- `RELAY_PER_ACCOUNT_DAILY` / `RELAY_PER_IP_DAILY` / `RELAY_GLOBAL_DAILY`: meta-transactions per learner account (the delegate action's sender), per IP address and in total per UTC day (defaults 3, 10 and 200), under `relay:` and `relay-ip:` key prefixes. Requests that fail validation take no slot.
- A slot is taken **before** the account is created, so failed and repeated attempts count too.
- Counters live in the `FAUCET_LIMITS` KV namespace. KV is eventually consistent across Cloudflare locations; the global cap may overshoot by a few accounts in a burst from many places. Use a Durable Object if that ever matters.
- CORS: only `ALLOWED_ORIGINS` (comma list in `wrangler.toml`). `http://localhost:<any port>` is allowed only when `ALLOW_LOCALHOST=1` (set in `.dev.vars` for local dev, never in production). Other browser origins get 403. Missing or mistyped limits fall back to the defaults.

## Develop

```sh
cd worker
npm install
cp .dev.vars.example .dev.vars   # fill in a funded TESTNET account and its key; the file is git-ignored
npm test                         # handler, rate limits and CORS (no network)
npm run dev                      # wrangler dev on http://localhost:8787, no Cloudflare login needed
```

Point the app at it with `VITE_WORKER_URL=http://localhost:8787` in `.env.local`, then open `/lesson/placeholder-transfer?mode=testnet`.

Verified on 1 Nov 2026: `wrangler dev` (4.149.0) runs locally **without** a Cloudflare login, near-kit 0.20.2 runs inside workerd, and a real `POST /faucet` funded a fresh implicit account on testnet (tx `FYDGYXsSxBMyMH7RiFvcBNCuYUGrs2Yum77NgXndK1Mh`).

## Deploy (owner)

1. `npx wrangler login`
2. Create the faucet account (any funded testnet account works), for example with the public helper:
   `curl -X POST https://helper.testnet.near.org/account -H 'content-type: application/json' -d '{"newAccountId":"bon-faucet.testnet","newAccountPublicKey":"<ed25519 public key>"}'`
   Top it up from https://near-faucet.io if needed. 10 NEAR covers about 20 learners at 0.5 NEAR.
3. `npx wrangler kv namespace create FAUCET_LIMITS` and paste the id into `wrangler.toml`.
4. Set `ALLOWED_ORIGINS` in `wrangler.toml` to the app's real origin(s).
5. `npx wrangler secret put FAUCET_ACCOUNT_ID` and `npx wrangler secret put FAUCET_PRIVATE_KEY` (the `ed25519:...` private key). Optional: `npx wrangler secret put ONECLICK_JWT` (a 1Click API key, so quotes carry no unkeyed app fee; the bearer header is from 1Click's docs, not yet checked with a real key).
6. `npx wrangler deploy`, then build the app with `VITE_WORKER_URL=https://<worker>.workers.dev` and, optionally, `VITE_RETURN_ACCOUNT_ID=<faucet account>` so lesson transfers go back to the faucet.

Never commit `.dev.vars` or any key. The repo ships `.dev.vars.example` only.
