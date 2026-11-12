# Scene objects: one shape per concept

Status: **decided; stage 1 built** (7 Nov 2026). Owner decisions: account = mailbox, transaction =
parcel, signature = stamp, contract = scroll that shows it runs code. Built and used by lessons 1.1–1.3:
mailbox, parcel (+ action cards), stamp, scroll, tagged key, app screen, plus the existing key and coin.
Built for lesson 2.1 (8 Nov 2026): receipt (`ReceiptSlip` / `SvgReceiptSlip`), shard (`ShardRibbon` /
`SvgShardRibbon`, a flat ribbon with a swallowtail end) and gas refund (`RefundCoin` / `SvgRefundCoin`, a
coin with ↩: the network delivers a refund as a receipt, but it carries money, not work, so it is never
drawn as a slip). Built for lesson 3.3 (12 Nov 2026): RPC node (`RpcWindow` / `SvgRpcWindow`). Not built yet: block, blockchain,
wallet (key ring), gas, validator. Stage 0 still draws the old blocks.

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
| **Receipt** | A delivery slip that comes with the parcel | What an action becomes when it moves on (Stage 2) | pending, done, failed | `ReceiptSlip` |
| **Gas refund** | A coin with a return mark (↩) going back to the signer | Unused gas money coming home; delivered as a receipt, but money, not work | — | `RefundCoin` |
| **Gas / fee** | Small ink drops / a meter | Work costs a little, spent as you go | full / used | — |
| **RPC node** | A post-office counter window: a booth, an awning in the accent, a window and a ledge | The door you hand your envelope to | idle (dark window), `lit` (answering), `shut` (shutter down: it does not keep that block), down (`failed`: red awning, red cross) | `RpcWindow` / `SvgRpcWindow` (lesson 3.3); 0.3's `RpcNode` |
| **Shard** | A section of the book (a group of pages with its own coloured ribbon) | NEAR splits the chain into parallel parts | — | `ShardSlab` |
| **Validator** | A small stamping figure at a desk | Checks and stamps pages | — | — |
| **Person / learner** | 0.1's `Person` figure | Already standard | — | — |

| **Signing node** (Chain Signatures) | A small figure behind a desk, its key share (a piece of the key) lying on the desk | One node of the signing network: it holds a share, never the whole key, and adds it to a signature | share plain, share in the accent (added); pending (dashed) | `SignerNode` / `SvgSignerNode` (lesson 4.1) |
| **Another chain** | A short row of block pages standing up, linked by a string, the top edge in the chain's colour | The "blockchain" row, built: another chain, another page edge | edge in the accent (the chain that matters now) or plain | `Ledger` / `SvgLedger` (`showName={false}` when an area names it) |
| **Another chain's ground** | A marked area on the page: a light tint of the chain's colour in a dashed ink border, its name printed at the front edge, the chain itself (a `Ledger`) standing along the back edge | Splits the page by chain: what lives on that chain (an address, a delivered transaction) stands inside it, what lives on NEAR stays outside | plain; selected (thicker border). One pick for the whole area and its chain | `ChainArea` / `SvgChainArea` (lesson 4.1: "Ethereum (Sepolia)", tinted in the accent, 3 blocks) |
| **Bridge vault** (locked collateral) | A safe on the page: a box with a round door and a dial, a stack of coins in front | A pool of locked coins behind a door; the honeypot a bridge hack drains | full; cracked (red tint, red zigzag, door swung open); drained (coins gone, red cross) | `Vault` / `SvgVault` (lesson 4.3, lesson-local until a second lesson needs it) |
| **Confidential intent** | A heraldic shield with a padlock, standing beside the intent; a tinted dome closes over the parcel | Hidden from onlookers, still the same parcel inside | off (dashed, paper); on (accent, dome over the parcel) | `Shield` / `SvgShield` + `Dome` (lesson 4.3, lesson-local) |

Open: intents will need rows when that stage is designed. The validator above is still not built; lesson 4.1's signing node borrows its shape (a figure at a desk).

## How it fits the code

| File | What |
| --- | --- |
| `src/scene-kit/objects.ts` | Pure: `OBJECTS` (concept → shape), `ObjectState` and `lookOf` (how each state looks), the objects' dimensions, `itemSlots` (where action cards stand), `gaugeShare`. Unit tested; safe to import from 2D code. |
| `src/scene-kit/objects3d.tsx` | 3D: `Mailbox`, `Parcel` (+ `ActionCard`, `FATE_FILL`, `FATE_MARK`), `Stamp`, `Scroll`, `TaggedKey`, `AppScreen`, `SignerNode`, `Ledger`, `ChainArea`, `Cross`, `Strike`. Exported from `src/scene-kit`. `ChainArea` is cheap: one tinted plane, one dashed line, the `Ledger`; its name is an HTML label. |
| `src/scene-kit/svg/objects.tsx` | 2D twins: `SvgMailbox`, `SvgParcel`, `SvgStamp`, `SvgScroll`, `SvgTaggedKey`, `SvgAppScreen`, `SvgSignerNode`, `SvgLedger`, `SvgChainArea`, and `ObjectIcon` (the same shapes small, for HTML card headers). |
| `src/content/lessons/scene-objects/` | Hidden gallery, `/lesson/scene-objects`: every object in every state, 2D and 3D. |

- Every object takes `state` (`"ok" | "pending" | "failed" | "gone"`), an accent `color` and the usual
  pick props (`onPick`, `pickLabel`, `selected`).
- Lessons draw objects a little bigger than their layout unit (`OBJ = SIZE * 1.35`): mailboxes and
  scrolls are slimmer than the old blocks.
- Old names (`AccountBlock`, `ContractBlock`, ...) stay until stage 0 moves over, then go.
- Parts kept exported on purpose: `ActionCard`, `Cross`, `Strike`, `Stamp`, `FATE_FILL`, `FATE_MARK`,
  `SvgStamp` and the `SvgParcelItem` type. Today they are drawn inside `Parcel`, `SvgParcel` and the
  object states, and no lesson imports them directly. They stay in the kit for a scene that needs one
  part alone (a lone action card, a stamp being pressed, a struck object) or a legend in the same
  colours, so it does not copy them.
- Next: stage 0 (0.1 is also the `BookScene` reference, now merged into `stage-1`), then the rows not
  built yet as their lessons need them.

## Decisions (7 Nov 2026)

- Account: **mailbox**. It keeps "account" apart from "wallet" (where your keys live, lesson 0.2), and a
  parcel is delivered to a mailbox.
- Transaction: **parcel with a stamp** (the stamp is the signature). It opens to show the actions inside.
- Contract: **scroll**, with a gear on its seal as the sign that it runs code.
- App (added for lesson 1.2): **a screen on a stand**.
