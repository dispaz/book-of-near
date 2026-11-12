#![allow(dead_code)]
use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use near_workspaces::{network::Sandbox, types::NearToken, Account, Contract, Worker};
use serde_json::json;

pub const WASM: &str = "../target/badge.wasm";
pub const SANDBOX_VERSION: &str = "2.6.5";
pub const FAR_FUTURE: u64 = 4_000_000_000_000; // ms, year 2096
pub const GAS: near_workspaces::types::Gas = near_workspaces::types::Gas::from_tgas(60);

pub struct Env {
    pub worker: Worker<Sandbox>,
    pub contract: Contract,
    pub owner: Account,
    pub signer: SigningKey,
}

pub fn key(seed: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed; 32])
}

pub fn near_key(k: &SigningKey) -> String {
    format!(
        "ed25519:{}",
        bs58::encode(k.verifying_key().to_bytes()).into_string()
    )
}

pub async fn setup() -> Env {
    // near-workspaces 0.20 cannot read the validator list of its default sandbox (2.9.0), so pin one it can.
    let worker = near_workspaces::sandbox_with_version(SANDBOX_VERSION)
        .await
        .unwrap();
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
    Env {
        worker,
        contract,
        owner,
        signer,
    }
}

/// A learner who holds only a little NEAR for gas, as in the app.
pub async fn learner(env: &Env, name: &str) -> Account {
    env.owner
        .create_subaccount(name)
        .initial_balance(NearToken::from_millinear(100))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap()
}

pub fn sign(signer: &SigningKey, message: &str) -> String {
    STANDARD.encode(signer.sign(message.as_bytes()).to_bytes())
}

pub async fn stage_claim(
    env: &Env,
    account: &Account,
    stage: u32,
    expires: u64,
    signer: &SigningKey,
) -> serde_json::Value {
    let msg = format!(
        "bon-badge-v1|{}|{}|stage|{}|{}",
        env.contract.id(),
        account.id(),
        stage,
        expires
    );
    json!({ "stage": stage, "expires_at_ms": expires, "signature": sign(signer, &msg) })
}

pub async fn claim(
    env: &Env,
    account: &Account,
    stage: u32,
) -> near_workspaces::result::ExecutionFinalResult {
    let args = stage_claim(env, account, stage, FAR_FUTURE, &env.signer).await;
    account
        .call(env.contract.id(), "claim_stage")
        .args_json(args)
        .gas(GAS)
        .transact()
        .await
        .unwrap()
}

pub fn failure_text(r: &near_workspaces::result::ExecutionFinalResult) -> String {
    assert!(r.is_failure(), "expected the call to fail");
    format!("{:?}", r.failures())
}

pub async fn has_badge(env: &Env, account: &Account, stage: u32) -> bool {
    env.contract
        .view("has_badge")
        .args_json(json!({ "account_id": account.id(), "stage": stage }))
        .await
        .unwrap()
        .json()
        .unwrap()
}
