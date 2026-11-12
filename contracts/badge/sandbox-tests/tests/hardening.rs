//! More badge contract tests: owner-only methods, final-badge negatives, domain separation,
//! key rotation, expiry, storage payer.
mod common;
use common::*;
use near_workspaces::types::NearToken;
use near_workspaces::Account;
use serde_json::json;

fn final_args(
    env: &Env,
    account: &Account,
    route: &str,
    rarity: &str,
    expires: u64,
    signer: &ed25519_dalek::SigningKey,
) -> serde_json::Value {
    let msg = format!(
        "bon-badge-v1|{}|{}|final|{}|{}|{}",
        env.contract.id(),
        account.id(),
        route,
        rarity,
        expires
    );
    json!({ "route": route, "rarity": rarity, "expires_at_ms": expires, "signature": sign(signer, &msg) })
}

async fn call_final(
    env: &Env,
    account: &Account,
    args: serde_json::Value,
) -> near_workspaces::result::ExecutionFinalResult {
    account
        .call(env.contract.id(), "claim_final")
        .args_json(args)
        .gas(GAS)
        .transact()
        .await
        .unwrap()
}

/// A learner who holds stages 0 to 2 (route "builder").
async fn finished_learner(env: &Env, name: &str) -> Account {
    let a = learner(env, name).await;
    for s in 0..3 {
        assert!(claim(env, &a, s).await.is_success());
    }
    a
}

#[tokio::test]
async fn only_the_owner_can_use_owner_methods() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let calls = [
        ("set_route", json!({ "route": "x", "stages": [0] })),
        ("set_daily_cap", json!({ "daily_cap": 5 })),
        ("set_claim_key", json!({ "claim_key": near_key(&key(3)) })),
        (
            "set_art",
            json!({ "key": "stage-0", "media": "a.svg", "media_hash": "AAAA" }),
        ),
        (
            "set_base_uri",
            json!({ "base_uri": "https://evil.test", "icon": null }),
        ),
        ("set_stage_count", json!({ "stage_count": 9 })),
    ];
    for (method, args) in calls {
        let r = ana
            .call(env.contract.id(), method)
            .args_json(args)
            .transact()
            .await
            .unwrap();
        assert!(
            failure_text(&r).contains("Only the owner"),
            "{method} should be owner-only"
        );
    }
}

#[tokio::test]
async fn set_base_uri_keeps_the_icon_when_none_is_given() {
    let env = setup().await;
    let set = |uri: &str, icon: serde_json::Value| {
        env.owner
            .call(env.contract.id(), "set_base_uri")
            .args_json(json!({ "base_uri": uri, "icon": icon }))
            .transact()
    };
    set("https://a.test", json!("data:image/svg+xml;base64,AAAA"))
        .await
        .unwrap()
        .into_result()
        .unwrap();
    set("https://b.test", json!(null))
        .await
        .unwrap()
        .into_result()
        .unwrap();
    let meta: serde_json::Value = env
        .contract
        .view("nft_metadata")
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(meta["base_uri"], "https://b.test");
    assert_eq!(meta["icon"], "data:image/svg+xml;base64,AAAA");
}

#[tokio::test]
async fn final_badge_negatives() {
    let env = setup().await;
    let ana = finished_learner(&env, "ana").await;

    // unknown route
    let r = call_final(
        &env,
        &ana,
        final_args(&env, &ana, "nope", "common", FAR_FUTURE, &env.signer),
    )
    .await;
    assert!(failure_text(&r).contains("Unknown route"));
    // invalid rarity string (validly signed, still refused)
    let r = call_final(
        &env,
        &ana,
        final_args(&env, &ana, "builder", "mythic", FAR_FUTURE, &env.signer),
    )
    .await;
    assert!(failure_text(&r).contains("Unknown rarity"));
    // expired
    let r = call_final(
        &env,
        &ana,
        final_args(&env, &ana, "builder", "common", 1_000, &env.signer),
    )
    .await;
    assert!(failure_text(&r).contains("Claim expired"));
    // wrong signer
    let r = call_final(
        &env,
        &ana,
        final_args(&env, &ana, "builder", "common", FAR_FUTURE, &key(9)),
    )
    .await;
    assert!(failure_text(&r).contains("Invalid claim signature"));
    // nothing minted yet
    let held: bool = env
        .contract
        .view("has_final_badge")
        .args_json(json!({ "account_id": ana.id() }))
        .await
        .unwrap()
        .json()
        .unwrap();
    assert!(!held);

    // a valid one works, a second one (even with a fresh valid claim) does not
    let ok = call_final(
        &env,
        &ana,
        final_args(&env, &ana, "builder", "common", FAR_FUTURE, &env.signer),
    )
    .await;
    assert!(ok.is_success(), "{:?}", ok.failures());
    let again = call_final(
        &env,
        &ana,
        final_args(
            &env,
            &ana,
            "builder",
            "legendary",
            FAR_FUTURE - 1,
            &env.signer,
        ),
    )
    .await;
    assert!(failure_text(&again).contains("already claimed"));
}

#[tokio::test]
async fn a_stage_signature_cannot_be_used_for_the_final_badge() {
    let env = setup().await;
    let ana = finished_learner(&env, "ana").await;
    // Signature over the stage-0 message, offered as a final-badge claim.
    let stage_sig = stage_claim(&env, &ana, 0, FAR_FUTURE, &env.signer).await["signature"].clone();
    let args = json!({ "route": "builder", "rarity": "common", "expires_at_ms": FAR_FUTURE, "signature": stage_sig });
    let r = call_final(&env, &ana, args).await;
    assert!(failure_text(&r).contains("Invalid claim signature"));
}

#[tokio::test]
async fn nft_transfer_call_is_refused() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let ben = learner(&env, "ben").await;
    assert!(claim(&env, &ana, 0).await.is_success());
    let r = ana
        .call(env.contract.id(), "nft_transfer_call")
        .args_json(json!({ "receiver_id": ben.id(), "token_id": "1", "msg": "" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await
        .unwrap();
    assert!(failure_text(&r).contains("not supported"));
}

#[tokio::test]
async fn rotating_the_claim_key_invalidates_old_signatures() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let old_claim = stage_claim(&env, &ana, 0, FAR_FUTURE, &env.signer).await;
    let new_key = key(5);
    env.owner
        .call(env.contract.id(), "set_claim_key")
        .args_json(json!({ "claim_key": near_key(&new_key) }))
        .transact()
        .await
        .unwrap()
        .into_result()
        .unwrap();
    let r = ana
        .call(env.contract.id(), "claim_stage")
        .args_json(old_claim)
        .gas(GAS)
        .transact()
        .await
        .unwrap();
    assert!(failure_text(&r).contains("Invalid claim signature"));
    let fresh = stage_claim(&env, &ana, 0, FAR_FUTURE, &new_key).await;
    let ok = ana
        .call(env.contract.id(), "claim_stage")
        .args_json(fresh)
        .gas(GAS)
        .transact()
        .await
        .unwrap();
    assert!(ok.is_success(), "{:?}", ok.failures());
}

#[tokio::test]
async fn expiry_is_checked_against_block_time() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let now_ms = env.worker.view_block().await.unwrap().timestamp() / 1_000_000;
    // Expired a second ago: refused. (Sandbox blocks follow wall-clock time, so the exact
    // boundary block is not reproducible; a claim a minute in the future must pass.)
    let past = stage_claim(&env, &ana, 0, now_ms - 1_000, &env.signer).await;
    let r = ana
        .call(env.contract.id(), "claim_stage")
        .args_json(past)
        .gas(GAS)
        .transact()
        .await
        .unwrap();
    assert!(failure_text(&r).contains("Claim expired"));
    let soon = stage_claim(&env, &ana, 0, now_ms + 60_000, &env.signer).await;
    let ok = ana
        .call(env.contract.id(), "claim_stage")
        .args_json(soon)
        .gas(GAS)
        .transact()
        .await
        .unwrap();
    assert!(ok.is_success(), "{:?}", ok.failures());
}

#[tokio::test]
async fn the_contract_pays_storage_not_the_learner() {
    let env = setup().await;
    let ana = learner(&env, "ana").await;
    let contract_before = env.contract.view_account().await.unwrap();
    let learner_before = ana.view_account().await.unwrap();
    assert!(claim(&env, &ana, 0).await.is_success());
    let contract_after = env.contract.view_account().await.unwrap();
    let learner_after = ana.view_account().await.unwrap();

    let bytes = contract_after.storage_usage - contract_before.storage_usage;
    println!("storage per first stage badge: {bytes} bytes");
    assert!(bytes > 0, "the contract's storage must grow");
    assert!(
        bytes < 1_000,
        "one badge should take well under 1 KB, got {bytes}"
    );
    assert_eq!(
        learner_after.storage_usage, learner_before.storage_usage,
        "learner storage must not change"
    );

    // The storage view reports the contract's own balance and storage use.
    let status: serde_json::Value = env
        .contract
        .view("storage_status")
        .await
        .unwrap()
        .json()
        .unwrap();
    assert_eq!(status["storage_usage"], contract_after.storage_usage);
    assert_eq!(status["tokens"], 1);
    let available: u128 = status["available"].as_str().unwrap().parse().unwrap();
    assert!(available > 0);
}
