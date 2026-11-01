# Book of NEAR Worker

A Cloudflare Worker. Today it runs the **testnet faucet** (issue #7); the badge claim signer, exam grader and intents proxy come later.

## Routes

| Route | What it does |
| --- | --- |
| `POST /faucet` `{ publicKey, accountId? }` | Funds a learner's practice account with `FAUCET_AMOUNT` NEAR (default 0.5) from the faucet account. Without `accountId` it funds the implicit account of `publicKey` (64 hex characters). With `accountId: "name.testnet"` it creates that name through `testnet.create_account`. Returns `{ accountId, txHash, amount }`. |
| `GET /health` | `{ ok: true, faucet: <secrets configured?> }` |

Errors are JSON `{ error }` in plain English: 400 bad input, 403 origin not allowed, 409 account exists, 429 daily limit, 502 testnet unreachable, 503 no secrets set.

## Limits (cannot be drained from one address)

- `PER_IP_DAILY` accounts per IP address per UTC day (default 3), keyed on `cf-connecting-ip`.
- `GLOBAL_DAILY` accounts per UTC day in total (default 50, so at most 25 NEAR a day at 0.5 NEAR).
- A slot is taken **before** the account is created, so failed and repeated attempts count too.
- Counters live in the `FAUCET_LIMITS` KV namespace. KV is eventually consistent across Cloudflare locations; the global cap may overshoot by a few accounts in a burst from many places. Use a Durable Object if that ever matters.
- CORS: only `ALLOWED_ORIGINS` (comma list in `wrangler.toml`) and `http://localhost:<any port>`. Other browser origins get 403.

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
5. `npx wrangler secret put FAUCET_ACCOUNT_ID` and `npx wrangler secret put FAUCET_PRIVATE_KEY` (the `ed25519:...` private key).
6. `npx wrangler deploy`, then build the app with `VITE_WORKER_URL=https://<worker>.workers.dev` and, optionally, `VITE_RETURN_ACCOUNT_ID=<faucet account>` so lesson transfers go back to the faucet.

Never commit `.dev.vars` or any key. The repo ships `.dev.vars.example` only.
