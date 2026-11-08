# Scene objects: one shape per concept

Status: **decided; stage 1 built** (7 Nov 2026). Owner decisions: account = mailbox, transaction =
parcel, signature = stamp, contract = scroll that shows it runs code. Built and used by lessons 1.1–1.3:
mailbox, parcel (+ action cards), stamp, scroll, tagged key, app screen, plus the existing key and coin.
Built for lesson 2.1 (8 Nov 2026): receipt (`ReceiptSlip` / `SvgReceiptSlip`, a refund shows ↩) and shard
(`ShardRibbon` / `SvgShardRibbon`, a flat ribbon with a swallowtail end). Not built yet: block, blockchain,
wallet (key ring), gas, RPC node, validator. Stage 0 still draws the old blocks.

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
| **Account / address** | A mailbox on a post, its name above it; the flag goes up when something arrived | Has an address, receives parcels, belongs to someone | named, implicit (hex name), not created (dashed), deleted (struck out); flag up | `AccountBlock` |
| **Balance / token** | A coin; several coins as a short stack on the account | Universal money sign | NEAR coin vs other token (different face mark) | `Coin` |
| **Transaction** | A parcel, addressed to one receiver (the label) | Sent from one account to another, packed with actions; one address label = one receiver | packing (open, no stamp), signed (stamped), delivered, failed (red, red cross). **Open**: the flaps lift and the action cards stand above the box, first action on top | lesson-made cards, 1.3's slabs |
| **Action** | A card packed in the parcel, standing above it when open | A transaction is a list of actions | idle, done ✓ (green tint), undone ↺, failed ✗ (red tint), never ran – | 1.3's action slabs |
| **Signing / signature** | A stamp on the parcel (the sender's mark, with a postmark ring) | Proves who sent it; changing the parcel after it was stamped breaks it | valid, broken (`stampBroken`: red, struck). A failed transaction keeps a valid stamp | 0.2 sign/verify blocks |
| **Key (full access)** | A plain key | Opens everything | revoked (struck out) | `Key` |
| **Key (function-call)** | A key with a paper tag on a string; the tag names what it may call and shows the allowance as a gauge | Same key, visibly limited | gauge full to empty; revoked (grey, struck out) | `Key` + note |
| **Wallet** | A key ring holding one or more keys | A wallet is where your keys live, not your money | locked / unlocked | 0.2's wallet box |
| **Contract** | A scroll standing up, lines of rules on it, a gear on its seal | A contract is written rules (the scroll) that run as code (the gear) | idle, running (the gear turns), failed (red cross), not deployed (dashed) | `ContractBlock` |
| **App** | A screen on a small stand, a title bar in the accent colour | A program that can hold a key and sign with it (a game, a website, a bot) | ok, hacked (red cross) | 1.2's agent block |
| **Receipt** | A delivery slip that comes with the parcel | What an action becomes when it moves on (Stage 2) | pending, done, failed | — |
| **Gas / fee** | Small ink drops / a meter | Work costs a little, spent as you go | full / used | — |
| **RPC node** | A post-office counter window | The door you hand your envelope to | busy, down | 0.3's `RpcNode` |
| **Shard** | A section of the book (a group of pages with its own coloured ribbon) | NEAR splits the chain into parallel parts | — | `ShardSlab` |
| **Validator** | A small stamping figure at a desk | Checks and stamps pages | — | — |
| **Person / learner** | 0.1's `Person` figure | Already standard | — | — |

Open: chain signatures (Stage 4 showpiece) and intents will need rows when those stages are designed.

## How it fits the code

| File | What |
| --- | --- |
| `src/scene-kit/objects.ts` | Pure: `OBJECTS` (concept → shape), `ObjectState` and `lookOf` (how each state looks), the objects' dimensions, `itemSlots` (where action cards stand), `gaugeShare`. Unit tested; safe to import from 2D code. |
| `src/scene-kit/objects3d.tsx` | 3D: `Mailbox`, `Parcel` (+ `ActionCard`, `FATE_FILL`, `FATE_MARK`), `Stamp`, `Scroll`, `TaggedKey`, `AppScreen`, `Cross`, `Strike`. Exported from `src/scene-kit`. |
| `src/scene-kit/svg/objects.tsx` | 2D twins: `SvgMailbox`, `SvgParcel`, `SvgStamp`, `SvgScroll`, `SvgTaggedKey`, `SvgAppScreen`, and `ObjectIcon` (the same shapes small, for HTML card headers). |
| `src/content/lessons/scene-objects/` | Hidden gallery, `/lesson/scene-objects`: every object in every state, 2D and 3D. |

- Every object takes `state` (`"ok" | "pending" | "failed" | "gone"`), an accent `color` and the usual
  pick props (`onPick`, `pickLabel`, `selected`).
- Lessons draw objects a little bigger than their layout unit (`OBJ = SIZE * 1.35`): mailboxes and
  scrolls are slimmer than the old blocks.
- Old names (`AccountBlock`, `ContractBlock`, ...) stay until stage 0 moves over, then go.
- Next: stage 0 (0.1 is also the `BookScene` reference, now merged into `stage-1`), then the rows not
  built yet as their lessons need them.

## Decisions (7 Nov 2026)

- Account: **mailbox**. It keeps "account" apart from "wallet" (where your keys live, lesson 0.2), and a
  parcel is delivered to a mailbox.
- Transaction: **parcel with a stamp** (the stamp is the signature). It opens to show the actions inside.
- Contract: **scroll**, with a gear on its seal as the sign that it runs code.
- App (added for lesson 1.2): **a screen on a stand**.
