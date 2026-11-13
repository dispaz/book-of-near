/**
 * The final exam's answer key (issue #28). NEVER import this file statically from app code:
 * `examFlow.ts` loads it with `import()` only to grade a demo exam (demo mode has no network by rule),
 * and the Worker imports it to grade testnet exams. `answerKey.test.ts` enforces this, and the e2e
 * test checks that no script the exam page downloads before grading holds `ANSWER_KEY_MARK`.
 *
 * `answer` is the index of the right option in `bank.ts`. `why[i]` explains option i, shown after
 * the exam is graded.
 */

/** A marker the e2e test looks for in downloaded scripts. */
export const ANSWER_KEY_MARK = "bon-exam-answer-key-v1";

export interface KeyEntry {
  answer: number;
  why: string[];
}

export const ANSWER_KEY: Record<string, KeyEntry> = {
  "q-0-1-hash-link": {
    answer: 1,
    why: [
      "Blocks are never deleted. The problem is the hash link.",
      "Each block stores the hash of the block before it, so an edit breaks the link to every later block.",
      "There is no password. Anyone can read the blocks and recompute the hashes.",
    ],
  },
  "q-0-2-seed-phrase": {
    answer: 2,
    why: [
      "That leaks half your secret and still helps an attacker.",
      "Whoever sees the phrase can rebuild your keys and take your funds.",
      "The seed phrase rebuilds your keys, so anyone who sees it can take your funds.",
    ],
  },
  "q-0-3-nonce": {
    answer: 0,
    why: [
      "A key's nonce only goes up, so a nonce that was used once is refused.",
      "The fee comes from gas times the gas price.",
      "Amounts are public. The nonce is just a counter.",
    ],
  },
  "q-1-1-valid-id": {
    answer: 2,
    why: [
      "Only lowercase letters are allowed.",
      "A mark such as a dot must sit between two letters or digits.",
      "Lowercase letters and digits, with a dash between two of them, are all allowed.",
    ],
  },
  "q-1-2-fc-key-cannot": {
    answer: 1,
    why: [
      "That is the one thing it is for.",
      "A function-call key can only call methods on the one contract it names. It cannot move NEAR.",
      "Gas is exactly what the allowance covers.",
    ],
  },
  "q-1-3-atomic-actions": {
    answer: 1,
    why: [
      "The actions of one transaction stand or fall together, so the first two were undone.",
      "The actions stand or fall together, so the account and the NEAR were undone. The work done up to the failure is still paid for.",
      "The work up to the failure was done, so the fee is still paid.",
    ],
  },
  "q-2-1-chunk": {
    answer: 2,
    why: [
      "Keys prove who you are. A chunk is network work.",
      "A chunk is only one shard's part of one block.",
      "Every shard makes one chunk in every block, side by side.",
    ],
  },
  "q-2-2-gas-burned": {
    answer: 1,
    why: [
      "That was the rule up to protocol version 86. From version 87, all of it is burned.",
      "From protocol version 87, all burnt gas is destroyed. Contracts get no share.",
      "Burnt gas is paid for and destroyed.",
    ],
  },
  "q-4-1-who-holds-key": {
    answer: 0,
    why: [
      "The signing nodes each hold a share and sign together. The whole key never exists in one place.",
      "No single party holds it. Each node holds only a share, and they sign together.",
      "Your browser only does the math for the address. The signature comes from the signing nodes.",
    ],
  },
  "q-4-2-intent-vs-tx": {
    answer: 2,
    why: [
      "An intent is a signed message, like a transaction.",
      "That describes a normal transaction. An intent states only the result you want.",
      "You say what you want; solvers work out the route and deliver it.",
    ],
  },
  "q-4-3-wrapped-backing": {
    answer: 1,
    why: [
      "Self-custody crypto has no deposit insurance.",
      "A wrapped token is a claim on the coins in the vault. With the vault drained, nothing backs it.",
      "The record on the other chain means nothing once the coins behind it are gone.",
    ],
  },
  "q-5-1-tee": {
    answer: 0,
    why: [
      "The chip keeps the enclave's memory encrypted while the code runs, so the host cannot read it.",
      "An enclave protects data while it is in memory and in use.",
      "How you pay has nothing to do with hardware security.",
    ],
  },
  "q-6-1-venear": {
    answer: 1,
    why: [
      "veNEAR is a way to share out voting power, not a fee.",
      "Locked NEAR gives voting power, and the longer it stays locked the more power it gives.",
      "Locking does not burn tokens: you can unlock them, after a 45-day wait.",
    ],
  },
  "q-7-1-fc-key-intent": {
    answer: 2,
    why: [
      "Full-access keys can do everything, which is why you keep them out of apps.",
      "Gas is still paid. The key's allowance covers it.",
      "A function-call key can only call one contract, so a leaked key cannot drain the account.",
    ],
  },
  "q-7-2-sharding-tradeoff": {
    answer: 0,
    why: [
      "Each call runs as a receipt in a later block, so a failure further down does not undo earlier steps.",
      "Privacy is a separate question. What sharding trades away is atomic calls across contracts.",
      "NEAR runs all the time; there is no weekly stop.",
    ],
  },

  "q-0-2-signature": {
    answer: 1,
    why: [
      "The check covers the message too, not only the key.",
      "A signature is made for one exact message. Change one letter and it no longer matches.",
      "Only the private key can make a new signature.",
    ],
  },
  "q-0-3-rpc": {
    answer: 2,
    why: [
      "Signing happens on your device; the RPC node only sees the signed result.",
      "That is a block explorer.",
      "Apps and wallets talk to the chain through RPC nodes: they send transactions and read state.",
    ],
  },
  "q-1-2-revoke": {
    answer: 0,
    why: [
      "A key stays valid until a transaction deletes it, and only a full-access key can do that.",
      "A key stays valid on the chain until it is deleted. Asking changes nothing on the chain.",
      "The allowance belongs to the key, not to your balance, and the key keeps working.",
    ],
  },
  "q-1-3-one-receiver": {
    answer: 1,
    why: [
      "A transaction has exactly one receiver.",
      "A transaction has exactly one receiver. Reaching another account takes a receipt or a second transaction.",
    ],
  },
  "q-2-1-first-shard": {
    answer: 2,
    why: [
      "The receiver's shard runs the receipt that follows, in a later block.",
      "The account name decides the shard, by sorting it against the boundary accounts.",
      "The signer's shard checks the signature and turns the transaction into a receipt.",
    ],
  },
  "q-2-2-callback-failure": {
    answer: 0,
    why: [
      "NEAR receipts commit one by one, across blocks, so your callback must handle the failure.",
      "NEAR receipts commit one by one, across blocks.",
      "Blocks are never rolled back for a contract's error.",
    ],
  },
  "q-3-1-storage": {
    answer: 2,
    why: [
      "There is no rent. The account keeps NEAR locked while the data exists.",
      "Every stored byte needs locked NEAR.",
      "Storage staking: 1 NEAR is locked per 100 KB, and it comes back when the data is deleted.",
    ],
  },
  "q-3-1-wasm": {
    answer: 1,
    why: [
      "That is Ethereum's format. NEAR runs Wasm.",
      "NEAR contracts are WebAssembly binaries, built from Rust or JavaScript.",
      "NEAR runs Wasm, not the JVM.",
    ],
  },
  "q-3-2-unregistered": {
    answer: 0,
    why: [
      "The token contract stores a balance record per holder, and someone must lock NEAR for its storage.",
      "Only the sender signs. The receiver needs a storage deposit.",
      "There is no such rule. The missing piece is storage for the balance record.",
    ],
  },
  "q-3-2-meta-tx": {
    answer: 2,
    why: [
      "Meta-transactions are public on chain.",
      "The user still signs the action.",
      "The user signs the action and a relayer sends it and pays the gas.",
    ],
  },
  "q-3-3-archival": {
    answer: 1,
    why: [
      "Regular nodes handle every new transaction.",
      "To read older blocks, a client must ask an archival node.",
      "Archival nodes answer the same HTTP JSON-RPC requests as regular ones.",
    ],
  },
  "q-4-1-derive-cost": {
    answer: 0,
    why: [
      "Deriving is math. Only asking the signing nodes for a signature costs gas.",
      "Deriving sends no transaction, so there is no fee. Only signing costs gas.",
      "Nothing happens on Ethereum when you derive. The address is just worked out.",
    ],
  },
  "q-4-3-bridge-honeypot": {
    answer: 1,
    why: [
      "NEAR is built to work across chains.",
      "No big vault of user coins waits on a bridge. Solvers pay out from their own funds.",
      "Intents still settle through a verifier contract on NEAR.",
    ],
  },
  "q-6-1-flash-loan": {
    answer: 2,
    why: [
      "Voting power is fixed when the vote opens, so NEAR locked during the vote does not count. NEAR locked earlier cannot come out for 45 days, long after a 10-minute loan is due.",
      "A loan contract does not see votes. The veNEAR rules stop it: power is fixed when the vote opens, and unlocking takes 45 days.",
      "A 10-minute loan cannot be locked before the vote opens and still be paid back in time.",
    ],
  },
  "q-7-1-receipts": {
    answer: 0,
    why: [
      "A receipt carries the call to the shard that holds the other contract, and it runs there in a later block.",
      "Shards process their chunks in parallel.",
      "Contracts live on many shards. Receipts carry calls between them.",
    ],
  },
};
