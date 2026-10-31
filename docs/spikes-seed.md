# Spike seed: unverified facts

Everything here came from reading docs and is **unverified**. Ticket 04 must test each against the real service and record the result here.

## 1Click / NEAR Intents
- Base URL `https://1click.chaindefuser.com`; endpoints `GET /v0/tokens`, `POST /v0/quote`, `POST /v0/deposit/submit`, `GET /v0/status`.
- `X-API-Key` header recommended; a key or JWT avoids a 0.1% fee.
- No documented testnet. Plan: dry-run quote in the lesson; tiny capped real mainnet swap only if the account has funds.

## Chain Signatures
- Contracts: `v1.signer` (mainnet), `v1.signer-prod.testnet` (testnet).
- chainsig.js calls: `deriveAddressAndPublicKey`, `prepareTransactionForSigning`, `sign`, `finalizeTransactionSigning`, `broadcastTx`.
- Target: derive an address and sign a Sepolia transaction with viem.

## near-kit and wallet
- Check near-kit API for account creation, function calls and access keys, and NEAR Connect (`@hot-labs/near-connect`) wallet flow on testnet.
- Check FastNEAR RPC limits and fallback endpoints.

## Result log
(ticket 04 fills this in)
