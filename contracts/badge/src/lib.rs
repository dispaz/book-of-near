//! Book of NEAR Badges: NEP-171 NFTs (NEP-177 metadata, NEP-297 events) that are minted from a
//! claim signed by the project's claim key. See docs/badge-contract.md.
//!
//! Rules the contract enforces:
//! - a claim is an ed25519 signature over account, stage and expiry (exact text in `stage_message`
//!   and `final_message`), made by the claim key the owner set;
//! - one badge per account per stage, and one final badge per account;
//! - stage n needs the badge for stage n - 1;
//! - the final badge needs every stage the chosen exam route requires;
//! - stage badges and the main final badge are non-transferable;
//! - the contract pays storage from its own balance, so claim methods take no deposit;
//! - the owner sets the stage count, the routes and a daily mint cap.
use near_sdk::json_types::Base64VecU8;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, CurveType, PanicOnDefault, PublicKey,
};

pub type TokenId = String;

const MS_PER_DAY: u64 = 86_400_000;
/// Slot key for the single final badge an account may hold.
const FINAL_SLOT: &str = "final";

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Tokens,
    Slots,
    ByOwner,
    Routes,
    Art,
}

#[derive(Clone, PartialEq, Debug)]
#[near(serializers = [borsh, json])]
pub enum Kind {
    Stage,
    Final,
}

#[derive(Clone)]
#[near(serializers = [borsh])]
struct Token {
    owner: AccountId,
    kind: Kind,
    stage: Option<u32>,
    route: Option<String>,
    rarity: Option<String>,
    transferable: bool,
    minted_at_ms: u64,
}

/// Image for one badge, owner set. `media` is relative to the collection `base_uri`.
#[derive(Clone)]
#[near(serializers = [borsh, json])]
pub struct Art {
    pub media: String,
    /// sha256 of the image bytes.
    pub media_hash: Base64VecU8,
}

/// NEP-177 collection metadata.
#[derive(Clone)]
#[near(serializers = [borsh, json])]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

/// NEP-177 token metadata. `extra` is a JSON string with kind, stage, route, rarity and transferable.
#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<Base64VecU8>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<Base64VecU8>,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    claim_key: PublicKey,
    metadata: NFTContractMetadata,
    stage_count: u32,
    daily_cap: u32,
    day: u64,
    minted_today: u32,
    next_token: u64,
    tokens: IterableMap<u64, Token>,
    /// "<account>|<slot>" -> token id. Slot is "s<stage>" or "final".
    slots: LookupMap<String, u64>,
    by_owner: LookupMap<AccountId, Vec<u64>>,
    routes: IterableMap<String, Vec<u32>>,
    /// "stage-<n>" or "final-<rarity>" -> image.
    art: IterableMap<String, Art>,
}

fn slot_key(account: &AccountId, slot: &str) -> String {
    format!("{account}|{slot}")
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, claim_key: PublicKey, stage_count: u32) -> Self {
        Self::check_key(&claim_key);
        Self {
            owner_id,
            claim_key,
            metadata: NFTContractMetadata {
                spec: "nft-1.0.0".into(),
                name: "Book of NEAR Badges".into(),
                symbol: "BOOK".into(),
                icon: None,
                base_uri: None,
                reference: None,
                reference_hash: None,
            },
            stage_count,
            daily_cap: 1_000,
            day: 0,
            minted_today: 0,
            next_token: 1,
            tokens: IterableMap::new(StorageKey::Tokens),
            slots: LookupMap::new(StorageKey::Slots),
            by_owner: LookupMap::new(StorageKey::ByOwner),
            routes: IterableMap::new(StorageKey::Routes),
            art: IterableMap::new(StorageKey::Art),
        }
    }

    // ---------- Claims ----------

    /// Mint the badge for `stage` to the caller. `signature` is the claim key's ed25519 signature
    /// over `stage_message` (base64). Takes no deposit: the contract pays storage.
    pub fn claim_stage(&mut self, stage: u32, expires_at_ms: u64, signature: Base64VecU8) -> TokenId {
        let account = env::predecessor_account_id();
        require!(stage < self.stage_count, "Unknown stage");
        self.check_claim(
            &self.stage_message(account.clone(), stage, expires_at_ms),
            expires_at_ms,
            &signature,
        );
        let slot = slot_key(&account, &format!("s{stage}"));
        require!(!self.slots.contains_key(&slot), "Badge for this stage already claimed");
        if stage > 0 {
            let prev = slot_key(&account, &format!("s{}", stage - 1));
            require!(self.slots.contains_key(&prev), "Claim the previous stage first");
        }
        self.count_mint();
        self.mint(
            slot,
            Token {
                owner: account,
                kind: Kind::Stage,
                stage: Some(stage),
                route: None,
                rarity: None,
                transferable: false,
                minted_at_ms: env::block_timestamp_ms(),
            },
        )
    }

    /// Mint the final badge to the caller. The caller must hold every stage the route requires.
    /// The claim key signs the rarity, so a learner cannot pick one.
    pub fn claim_final(
        &mut self,
        route: String,
        rarity: String,
        expires_at_ms: u64,
        signature: Base64VecU8,
    ) -> TokenId {
        let account = env::predecessor_account_id();
        require!(
            matches!(rarity.as_str(), "common" | "rare" | "epic" | "legendary"),
            "Unknown rarity"
        );
        let required = self.routes.get(&route).unwrap_or_else(|| env::panic_str("Unknown route"));
        self.check_claim(
            &self.final_message(account.clone(), route.clone(), rarity.clone(), expires_at_ms),
            expires_at_ms,
            &signature,
        );
        let slot = slot_key(&account, FINAL_SLOT);
        require!(!self.slots.contains_key(&slot), "Final badge already claimed");
        for stage in required {
            let held = self.slots.contains_key(&slot_key(&account, &format!("s{stage}")));
            require!(held, "A stage this route requires is missing");
        }
        self.count_mint();
        self.mint(
            slot,
            Token {
                owner: account,
                kind: Kind::Final,
                stage: None,
                route: Some(route),
                rarity: Some(rarity),
                transferable: false,
                minted_at_ms: env::block_timestamp_ms(),
            },
        )
    }

    /// The text the claim key signs for a stage badge.
    pub fn stage_message(&self, account_id: AccountId, stage: u32, expires_at_ms: u64) -> String {
        format!(
            "bon-badge-v1|{}|{}|stage|{}|{}",
            env::current_account_id(),
            account_id,
            stage,
            expires_at_ms
        )
    }

    /// The text the claim key signs for a final badge.
    pub fn final_message(
        &self,
        account_id: AccountId,
        route: String,
        rarity: String,
        expires_at_ms: u64,
    ) -> String {
        format!(
            "bon-badge-v1|{}|{}|final|{}|{}|{}",
            env::current_account_id(),
            account_id,
            route,
            rarity,
            expires_at_ms
        )
    }

    // ---------- Public views ----------

    /// Does the account hold the badge for this stage?
    pub fn has_badge(&self, account_id: AccountId, stage: u32) -> bool {
        self.slots.contains_key(&slot_key(&account_id, &format!("s{stage}")))
    }

    pub fn has_final_badge(&self, account_id: AccountId) -> bool {
        self.slots.contains_key(&slot_key(&account_id, FINAL_SLOT))
    }

    /// Stages the account holds a badge for, ascending.
    pub fn stages_of(&self, account_id: AccountId) -> Vec<u32> {
        let mut out: Vec<u32> = self
            .by_owner
            .get(&account_id)
            .into_iter()
            .flatten()
            .filter_map(|id| self.tokens.get(id).and_then(|t| t.stage))
            .collect();
        out.sort();
        out
    }

    pub fn get_stage_count(&self) -> u32 {
        self.stage_count
    }

    pub fn get_route(&self, route: String) -> Option<Vec<u32>> {
        self.routes.get(&route).cloned()
    }

    pub fn get_daily_cap(&self) -> u32 {
        self.daily_cap
    }

    pub fn get_claim_key(&self) -> PublicKey {
        self.claim_key.clone()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    // ---------- Owner methods ----------

    pub fn set_stage_count(&mut self, stage_count: u32) {
        self.assert_owner();
        require!(stage_count >= self.stage_count, "Stages cannot be removed");
        self.stage_count = stage_count;
    }

    /// Set (or replace) the stages an exam route needs for the final badge.
    pub fn set_route(&mut self, route: String, stages: Vec<u32>) {
        self.assert_owner();
        require!(stages.iter().all(|s| *s < self.stage_count), "Unknown stage in route");
        self.routes.insert(route, stages);
    }

    /// Most badges that may be minted per UTC day. 0 stops minting.
    pub fn set_daily_cap(&mut self, daily_cap: u32) {
        self.assert_owner();
        self.daily_cap = daily_cap;
    }

    pub fn set_claim_key(&mut self, claim_key: PublicKey) {
        self.assert_owner();
        Self::check_key(&claim_key);
        self.claim_key = claim_key;
    }

    pub fn set_base_uri(&mut self, base_uri: String, icon: Option<String>) {
        self.assert_owner();
        self.metadata.base_uri = Some(base_uri);
        self.metadata.icon = icon;
    }

    /// Image for "stage-<n>" or "final-<rarity>". Takes effect for badges minted afterwards.
    pub fn set_art(&mut self, key: String, media: String, media_hash: Base64VecU8) {
        self.assert_owner();
        self.art.insert(key, Art { media, media_hash });
    }

    // ---------- NEP-171 / NEP-177 ----------

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }

    pub fn nft_total_supply(&self) -> near_sdk::json_types::U128 {
        (self.tokens.len() as u128).into()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> near_sdk::json_types::U128 {
        (self.by_owner.get(&account_id).map(|v| v.len()).unwrap_or(0) as u128).into()
    }

    pub fn nft_token(&self, token_id: TokenId) -> Option<JsonToken> {
        let id: u64 = token_id.parse().ok()?;
        self.tokens.get(&id).map(|t| self.json_token(id, t))
    }

    pub fn nft_tokens(&self, from_index: Option<near_sdk::json_types::U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let from = from_index.map(|i| i.0 as usize).unwrap_or(0);
        self.tokens
            .iter()
            .skip(from)
            .take(limit.unwrap_or(50) as usize)
            .map(|(id, t)| self.json_token(*id, t))
            .collect()
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<near_sdk::json_types::U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let from = from_index.map(|i| i.0 as usize).unwrap_or(0);
        self.by_owner
            .get(&account_id)
            .into_iter()
            .flatten()
            .skip(from)
            .take(limit.unwrap_or(50) as usize)
            .filter_map(|id| self.tokens.get(id).map(|t| self.json_token(*id, t)))
            .collect()
    }

    /// Moves a token. Only tokens with `transferable: true` may move; every badge the claim methods
    /// mint is non-transferable, so this always refuses them.
    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        require!(env::attached_deposit().as_yoctonear() == 1, "Attach exactly 1 yoctoNEAR");
        require!(approval_id.is_none(), "Approvals are not supported");
        let id: u64 = token_id.parse().unwrap_or_else(|_| env::panic_str("Token not found"));
        let mut token = self.tokens.get(&id).cloned().unwrap_or_else(|| env::panic_str("Token not found"));
        require!(token.transferable, "This badge is non-transferable");
        let sender = env::predecessor_account_id();
        require!(token.owner == sender, "Only the owner can transfer");
        require!(receiver_id != sender, "Receiver must be a different account");
        let mut from_list = self.by_owner.get(&sender).cloned().unwrap_or_default();
        from_list.retain(|t| *t != id);
        self.by_owner.insert(sender.clone(), from_list);
        let mut to_list = self.by_owner.get(&receiver_id).cloned().unwrap_or_default();
        to_list.push(id);
        self.by_owner.insert(receiver_id.clone(), to_list);
        token.owner = receiver_id.clone();
        self.tokens.insert(id, token);
        let memo = memo.map(|m| format!(",\"memo\":{}", near_sdk::serde_json::to_string(&m).unwrap())).unwrap_or_default();
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.2.0\",\"event\":\"nft_transfer\",\"data\":[{{\"old_owner_id\":\"{sender}\",\"new_owner_id\":\"{receiver_id}\",\"token_ids\":[\"{id}\"]{memo}}}]}}"
        ));
    }

    /// Badges never move in a call chain, so this is not supported.
    #[payable]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) {
        let _ = (receiver_id, token_id, approval_id, memo, msg);
        env::panic_str("nft_transfer_call is not supported");
    }
}

impl Contract {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner can do this");
    }

    fn check_key(key: &PublicKey) {
        require!(
            key.curve_type() == CurveType::ED25519 && key.as_bytes().len() == 33,
            "Claim key must be an ed25519 key"
        );
    }

    fn check_claim(&self, message: &str, expires_at_ms: u64, signature: &Base64VecU8) {
        require!(env::block_timestamp_ms() <= expires_at_ms, "Claim expired");
        let sig: [u8; 64] = signature
            .0
            .as_slice()
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Signature must be 64 bytes"));
        let pk: [u8; 32] = self.claim_key.as_bytes()[1..]
            .try_into()
            .unwrap_or_else(|_| env::panic_str("Bad claim key"));
        require!(env::ed25519_verify(&sig, message.as_bytes(), &pk), "Invalid claim signature");
    }

    fn count_mint(&mut self) {
        let day = env::block_timestamp_ms() / MS_PER_DAY;
        if day != self.day {
            self.day = day;
            self.minted_today = 0;
        }
        require!(self.minted_today < self.daily_cap, "Daily mint cap reached");
        self.minted_today += 1;
    }

    fn mint(&mut self, slot: String, token: Token) -> TokenId {
        let id = self.next_token;
        self.next_token += 1;
        let owner = token.owner.clone();
        self.slots.insert(slot, id);
        let mut list = self.by_owner.get(&owner).cloned().unwrap_or_default();
        list.push(id);
        self.by_owner.insert(owner.clone(), list);
        self.tokens.insert(id, token);
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"nep171\",\"version\":\"1.2.0\",\"event\":\"nft_mint\",\"data\":[{{\"owner_id\":\"{owner}\",\"token_ids\":[\"{id}\"]}}]}}"
        ));
        id.to_string()
    }

    fn json_token(&self, id: u64, t: &Token) -> JsonToken {
        let (art_key, title, description) = match t.kind {
            Kind::Stage => {
                let n = t.stage.unwrap_or(0);
                (
                    format!("stage-{n}"),
                    format!("Book of NEAR: Stage {n}"),
                    format!("Finished stage {n} of the Book of NEAR course."),
                )
            }
            Kind::Final => {
                let r = t.rarity.clone().unwrap_or_default();
                (
                    format!("final-{r}"),
                    format!("Book of NEAR: Final badge ({r})"),
                    "Passed the Book of NEAR final exam.".to_string(),
                )
            }
        };
        let art = self.art.get(&art_key);
        let kind = if t.kind == Kind::Stage { "stage" } else { "final" };
        let extra = near_sdk::serde_json::json!({
            "kind": kind,
            "stage": t.stage,
            "route": t.route,
            "rarity": t.rarity,
            "transferable": t.transferable,
        })
        .to_string();
        JsonToken {
            token_id: id.to_string(),
            owner_id: t.owner.clone(),
            metadata: TokenMetadata {
                title: Some(title),
                description: Some(description),
                media: art.map(|a| a.media.clone()),
                media_hash: art.map(|a| a.media_hash.clone()),
                copies: None,
                issued_at: Some(t.minted_at_ms.to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: Some(extra),
                reference: None,
                reference_hash: None,
            },
        }
    }
}

