//! Badge contract tests in a local NEAR sandbox.
//! Build first: `npm run build:badge` (writes contracts/badge/target/.../book_of_near_badge.wasm).
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use near_workspaces::{network::Sandbox, types::NearToken, Account, Contract, Worker};
use serde_json::json;

const WASM: &str = "../target/badge.wasm";
const SANDBOX_VERSION: &str = "2.6.5";
const FAR_FUTURE: u64 = 4_000_000_000_000; // ms, year 2096
const GAS: near_workspaces::types::Gas = near_workspaces::types::Gas::from_tgas(60);

struct Env {
    worker: Worker<Sandbox>,
    contract: Contract,
    owner: Account,
    signer: SigningKey,
}

fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

fn near_key(k: &SigningKey) -> String {
    format!("ed25519:{}", bs58::encode(k.verifying_key().to_bytes()).into_string())
}

async fn setup() -> Env {
    // near-workspaces 0.20 cannot read the validator list of its default sandbox (2.9.0), so pin one it can.
    let worker = near_workspaces::sandbox_with_version(SANDBOX_VERSION).await.unwrap();
    let wasm = std::fs::read(WASM).expect("build the contract first: npm run build:badge");
    let contract = worker.dev_deploy(&wasm).await.unwrap();
    let owner = worker.dev_create_account().await.unwrap();
    let signer = key(7);
    contract
        .call("new")
        .args_json(json!({
            "owner_id": owner.id(),
            "claim_key": near_key(&signer),
            "stage_count": 5
        }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();
    // Final exam route "builder" needs stages 0 to 2.
    owner
        .call(contract.id(), "set_route")
        .args_json(json!({ "route": "builder", "stages": [0, 1, 2] }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();
    Env { worker, contract, owner, signer }
}

/// A learner who holds only a little NEAR for gas, as in the app.
async fn learner(env: &Env, name: &str) -> Account {
    env.owner
        .create_subaccount(name)
        .initial_balance(NearToken::from_millinear(100))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap()
}

fn sign(signer: &SigningKey, message: &str) -> String {
    STANDARD.encode(signer.sign(message.as_bytes()).to_bytes())
}

async fn stage_claim(env: &Env, account: &Account, stage: u32, expires: u64, signer: &SigningKey) -> serde_json::Value {
    let msg = format!(
        "bon-badge-v1|{}|{}|stage|{}|{}",
        env.contract.id(),
        account.id(),
        stage,
        expires
    );
    json!({ "stage": stage, "expires_at_ms": expires, "signature": sign(signer, &msg) })
}

async fn claim(env: &Env, account: &Account, stage: u32) -> near_workspaces::result::ExecutionFinalResult {
    let args = stage_claim(env, account, stage, FAR_FUTURE, &env.signer).await;
    account
        .call(env.contract.id(), "claim_stage")
        .args_json(args)
        .gas(GAS)
        .transact()
        .await
        .unwrap()
}

fn failure_text(r: &near_workspaces::result::ExecutionFinalResult) -> String {
    assert!(r.is_failure(), "expected the call to fail");
    format!("{:?}", r.failures())
}

async fn has_badge(env: &Env, account: &Account, stage: u32) -> bool {
    env.contract
        .view("has_badge")
        .args_json(json!({ "account_id": account.id(), "stage": stage }))
        .await
        .unwrap()
        .json()
        .unwrap()
}

#[tokio::test]
async fn valid_claim_mints_a_non_transferable_stage_badge_without_a_deposit() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let before = ana.view_account().await.unwrap().balance;

    let result = claim(&env, &ana, 0).await;
    assert!(result.is_success(), "{:?}", result.failures());

    assert!(has_badge(&env, &ana, 0).await);
    assert!(!has_badge(&env, &ana, 1).await);
    // Only gas left the learner's account: well under 0.01 NEAR, and no attached deposit.
    let after = ana.view_account().await.unwrap().balance;
    assert!(before.as_yoctonear() - after.as_yoctonear() < NearToken::from_millinear(10).as_yoctonear());

    let tokens: serde_json::Value = env
        .contract
        .view("nft_tokens_for_owner")
        .args_json(json!({ "account_id": ana.id() }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(tokens.as_array().unwrap().len(), 1);
    assert_eq!(tokens[0]["owner_id"], ana.id().to_string());
    let extra: serde_json::Value = serde_json::from_str(tokens[0]["metadata"]["extra"].as_str().unwrap()).unwrap();
    assert_eq!(extra["kind"], "stage");
    assert_eq!(extra["stage"], 0);
    assert_eq!(extra["transferable"], false);
    // NEP-297 event
    let logs = result.logs().join("\n");
    assert!(logs.contains("EVENT_JSON:") && logs.contains("\"nft_mint\"") && logs.contains("nep171"));
}

#[tokio::test]
async fn expired_claim_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let args = stage_claim(&env, &ana, 0, 1_000, &env.signer).await;
    let r = ana.call(env.contract.id(), "claim_stage").args_json(args).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&r).contains("Claim expired"));
    assert!(!has_badge(&env, &ana, 0).await);
}

#[tokio::test]
async fn replayed_claim_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let args = stage_claim(&env, &ana, 0, FAR_FUTURE, &env.signer).await;
    let first = ana.call(env.contract.id(), "claim_stage").args_json(args.clone()).gas(GAS).transact().await.unwrap();
    assert!(first.is_success());
    let again = ana.call(env.contract.id(), "claim_stage").args_json(args.clone()).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&again).contains("already claimed"));
    // Someone else cannot reuse Ana's claim either: the signature covers her account.
    let ben = learner(&env, "ben").await;
    let stolen = ben.call(env.contract.id(), "claim_stage").args_json(args).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&stolen).contains("Invalid claim signature"));
}

#[tokio::test]
async fn claim_signed_by_the_wrong_key_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let args = stage_claim(&env, &ana, 0, FAR_FUTURE, &key(9)).await;
    let r = ana.call(env.contract.id(), "claim_stage").args_json(args).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&r).contains("Invalid claim signature"));
}

#[tokio::test]
async fn skipping_a_stage_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let r = claim(&env, &ana, 1).await;
    assert!(failure_text(&r).contains("previous stage"));
    assert!(claim(&env, &ana, 0).await.is_success());
    assert!(claim(&env, &ana, 1).await.is_success());
    assert!(has_badge(&env, &ana, 1).await);
}

#[tokio::test]
async fn second_badge_for_the_same_stage_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    assert!(claim(&env, &ana, 0).await.is_success());
    // A fresh, valid claim (different expiry) still cannot mint stage 0 twice.
    let args = stage_claim(&env, &ana, 0, FAR_FUTURE - 1, &env.signer).await;
    let r = ana.call(env.contract.id(), "claim_stage").args_json(args).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&r).contains("already claimed"));
    let supply: String = env.contract.view("nft_supply_for_owner").args_json(json!({ "account_id": ana.id() })).await.unwrap().json().unwrap();
    assert_eq!(supply, "1");
}

#[tokio::test]
async fn transfer_of_a_non_transferable_token_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let ben = learner(&env, "ben").await;
    assert!(claim(&env, &ana, 0).await.is_success());
    let r = ana
        .call(env.contract.id(), "nft_transfer")
        .args_json(json!({ "receiver_id": ben.id(), "token_id": "1" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await
        .unwrap();
    assert!(failure_text(&r).contains("non-transferable"));
    assert!(has_badge(&env, &ana, 0).await);
    assert!(!has_badge(&env, &ben, 0).await);
}

#[tokio::test]
async fn owner_adds_a_stage_and_changes_a_route_without_redeploying() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    for s in 0..5 {
        assert!(claim(&env, &ana, s).await.is_success());
    }
    // Stage 5 does not exist yet.
    assert!(failure_text(&claim(&env, &ana, 5).await).contains("Unknown stage"));
    // Only the owner can add one.
    let nope = ana.call(env.contract.id(), "set_stage_count").args_json(json!({ "stage_count": 6 })).transact().await.unwrap();
    assert!(failure_text(&nope).contains("Only the owner"));
    env.owner.call(env.contract.id(), "set_stage_count").args_json(json!({ "stage_count": 6 })).transact().await.unwrap().into_result().unwrap();
    assert!(claim(&env, &ana, 5).await.is_success());

    // Final badge: route "builder" needs 0..=2; change it to need stage 5 as well.
    env.owner
        .call(env.contract.id(), "set_route")
        .args_json(json!({ "route": "builder", "stages": [0, 1, 2, 5] }))
        .transact().await.unwrap().into_result().unwrap();
    let route: Vec<u32> = env.contract.view("get_route").args_json(json!({ "route": "builder" })).await.unwrap().json().unwrap();
    assert_eq!(route, vec![0, 1, 2, 5]);
    let _ = &env.worker;
}

#[tokio::test]
async fn final_badge_needs_the_route_stages_and_carries_a_signed_rarity() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let final_msg = |rarity: &str| {
        format!("bon-badge-v1|{}|{}|final|builder|{}|{}", env.contract.id(), ana.id(), rarity, FAR_FUTURE)
    };
    let final_args = |rarity: &str, signed: &str| {
        json!({ "route": "builder", "rarity": rarity, "expires_at_ms": FAR_FUTURE, "signature": sign(&env.signer, &final_msg(signed)) })
    };
    // No stages yet.
    let r = ana.call(env.contract.id(), "claim_final").args_json(final_args("rare", "rare")).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&r).contains("route requires is missing"));
    for s in 0..3 {
        assert!(claim(&env, &ana, s).await.is_success());
    }
    // A learner cannot upgrade the rarity the Worker signed.
    let r = ana.call(env.contract.id(), "claim_final").args_json(final_args("legendary", "common")).gas(GAS).transact().await.unwrap();
    assert!(failure_text(&r).contains("Invalid claim signature"));
    let ok = ana.call(env.contract.id(), "claim_final").args_json(final_args("epic", "epic")).gas(GAS).transact().await.unwrap();
    assert!(ok.is_success(), "{:?}", ok.failures());
    let tokens: serde_json::Value = env.contract.view("nft_tokens_for_owner").args_json(json!({ "account_id": ana.id() })).await.unwrap().json().unwrap();
    let last = tokens.as_array().unwrap().last().unwrap();
    let extra: serde_json::Value = serde_json::from_str(last["metadata"]["extra"].as_str().unwrap()).unwrap();
    assert_eq!(extra["kind"], "final");
    assert_eq!(extra["rarity"], "epic");
    assert_eq!(extra["transferable"], false);
    let held: bool = env.contract.view("has_final_badge").args_json(json!({ "account_id": ana.id() })).await.unwrap().json().unwrap();
    assert!(held);
}

#[tokio::test]
async fn daily_cap_stops_minting() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let ben = learner(&env, "ben").await;
    env.owner.call(env.contract.id(), "set_daily_cap").args_json(json!({ "daily_cap": 1 })).transact().await.unwrap().into_result().unwrap();
    assert!(claim(&env, &ana, 0).await.is_success());
    assert!(failure_text(&claim(&env, &ben, 0).await).contains("Daily mint cap"));
}

#[tokio::test]
async fn token_shows_collection_metadata_and_badge_image() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    env.owner
        .call(env.contract.id(), "set_base_uri")
        .args_json(json!({ "base_uri": "https://example.test/badges", "icon": null }))
        .transact().await.unwrap().into_result().unwrap();
    env.owner
        .call(env.contract.id(), "set_art")
        .args_json(json!({ "key": "stage-0", "media": "stage-0.svg", "media_hash": STANDARD.encode([1u8; 32]) }))
        .transact().await.unwrap().into_result().unwrap();
    assert!(claim(&env, &ana, 0).await.is_success());
    let meta: serde_json::Value = env.contract.view("nft_metadata").await.unwrap().json().unwrap();
    assert_eq!(meta["spec"], "nft-1.0.0");
    assert_eq!(meta["name"], "Book of NEAR Badges");
    assert_eq!(meta["symbol"], "BOOK");
    let token: serde_json::Value = env.contract.view("nft_token").args_json(json!({ "token_id": "1" })).await.unwrap().json().unwrap();
    assert_eq!(token["metadata"]["media"], "stage-0.svg");
    assert_eq!(token["metadata"]["media_hash"], STANDARD.encode([1u8; 32]));
}
