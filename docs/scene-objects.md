# Scene objects: one shape per concept

Status: **proposal, partly decided** (7 Nov 2026). Nothing here is built yet. Owner decisions so far:
transaction = parcel, signature = stamp, contract = scroll that shows it runs code. Account still open
(mailbox or wallet).

## Why

Today almost every concept is a rounded box in a different colour: `AccountBlock`, `ContractBlock`,
`ChainBlock`, `ShardSlab`, plus lesson-made boxes (`RoundedBox` and `GrowBlock` in 0.2, `Slab` in 1.3).
The learner has to read the label to know what they are looking at, and colour is already taken by the
stage accent. A concept should be recognisable by its **shape alone**, the same in every lesson and in
both views.

## Rules

1. **One concept, one object.** A lesson never invents its own shape for a concept in this table. It
   uses the kit component, or adds a new row here first.
2. **Shape carries meaning, colour does not.** Ink outline on paper white. The stage accent marks
   "this is the one that matters now", never which kind of thing it is.
3. **Both views.** Every 3D object has a 2D SVG twin with the same silhouette and the same `pickLabel`.
4. **States are part of the object.** Each object defines how it looks when *pending* (dashed),
   *ok*, *refused / failed* (ink-red cross-hatch), *gone* (struck out). Lessons don't restyle.
5. **Readable at small size.** The silhouette must work at 48 px on a phone, with no label.
6. **Fits the book.** Objects are paper-craft pop-ups standing on a page: flat-ish, folded, cut.

## The vocabulary

| Concept | Object | Why this shape | States / variants | Replaces |
| --- | --- | --- | --- | --- |
| **Block** | A page with a torn-off tab, linked to the previous page by a string (the hash) | A blockchain is a book of pages; the string is the hash link | sealed, tampered (string snaps, red) | `ChainBlock` pieces, 0.1's `LedgerBlock` |
| **Blockchain** | A short stack/row of linked block pages | Same object, repeated | another chain = different page edge | `ChainBlock` |
| **Account / address** | A mailbox with a name plate (open: or a wallet, see question 1) | Has an address, receives parcels, belongs to someone | named (plate), implicit (hex plate, small), not created (dashed) | `AccountBlock` |
| **Balance / token** | A coin; several coins as a short stack on the account | Universal money sign | NEAR coin vs other token (different face mark) | `Coin` |
| **Transaction** | A parcel, addressed to one receiver | Sent from one account to another, packed with actions; one address label = one receiver | packing (open box), signed (stamped), in flight, delivered, failed (red cross). **Opens**: click or focus to lift the lid and preview every action inside, in order | lesson-made cards, 1.3's card |
| **Action** | An item packed inside the parcel (a labelled card or small object per kind: create account, send NEAR, add key, call) | A transaction is a list of actions | ran / undone / failed / never ran | 1.3's action rows |
| **Signing / signature** | A stamp pressed onto the parcel (the sender's mark) | Proves who sent it; opening and changing the parcel breaks it | valid, broken (torn, red) | 0.2 sign/verify blocks |
| **Key (full access)** | A plain key | Opens everything | revoked (struck out) | `Key` |
| **Key (function-call)** | A key with a paper tag on a string; the tag names the contract and allowance | Same key, visibly limited | allowance as a gauge on the tag; empty; revoked | `Key` + note |
| **Wallet** | A key ring holding one or more keys | A wallet is where your keys live, not your money | locked / unlocked | 0.2's wallet box |
| **Contract** | A scroll with a small gear (cog) on its seal; the gear turns when the contract runs | A contract is written rules (the scroll) that run as code (the gear) | idle, running (gear turns, lines on the scroll light up), panicked (red) | `ContractBlock` |
| **Receipt** | A delivery slip that comes with the parcel | What an action becomes when it moves on (Stage 2) | pending, done, failed | — |
| **Gas / fee** | Small ink drops / a meter | Work costs a little, spent as you go | full / used | — |
| **RPC node** | A post-office counter window | The door you hand your envelope to | busy, down | 0.3's `RpcNode` |
| **Shard** | A section of the book (a group of pages with its own coloured ribbon) | NEAR splits the chain into parallel parts | — | `ShardSlab` |
| **Validator** | A small stamping figure at a desk | Checks and stamps pages | — | — |
| **Person / learner** | 0.1's `Person` figure | Already standard | — | — |

Open: chain signatures (Stage 4 showpiece) and intents will need rows when those stages are designed.

## How it fits the code

- Each row becomes one component in `src/scene-kit/objects/` (3D) and `src/scene-kit/svg/objects/` (2D),
  with a shared `state` prop (`"pending" | "ok" | "failed" | "gone"`) and `pickLabel`.
- A gallery page (the existing `scene-kit-demo` lesson) shows every object in every state, in both
  views, so the set is reviewed as a whole before lessons switch.
- Old names (`AccountBlock`, `ContractBlock`, ...) become thin aliases during the switch, then go.
- Lessons move one at a time, one commit each, after the gallery is approved. Stage 1 first, then
  0.1–0.3 (0.1 is also the `BookScene` reference on `main`, so do this after `main` is merged into
  `stage-1`).

## Questions for review

Answered (7 Nov 2026):
- Transaction: **parcel with a stamp** (the stamp is the signature). A parcel can be opened to preview
  all the actions packed inside.
- Contract: **scroll**, with a sign that it runs code (the gear on its seal).

Open:
1. Account: **mailbox or wallet?** The owner leans to wallet; mailbox also works. If the account is a
   wallet, the key ring needs another home (keys hang inside the wallet?), because today "wallet" means
   the place your keys live (lesson 0.2), not the account on chain. Mailbox keeps the two apart and
   matches parcels (a parcel is delivered to a mailbox).
