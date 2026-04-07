#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{PolicyManager, PolicyManagerClient};

fn setup() -> (Env, PolicyManagerClient<'static>) {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let contract_id = e.register(PolicyManager, (&owner, &30u32, &70u32));
    let client = PolicyManagerClient::new(&e, &contract_id);
    (e, client)
}

#[test]
fn test_default_thresholds() {
    let (_e, client) = setup();
    let (low, medium) = client.get_thresholds();
    assert_eq!(low, 30);
    assert_eq!(medium, 70);
}

#[test]
fn test_evaluate_allow() {
    let (e, client) = setup();
    let verdict = client.evaluate_score(&20);
    assert_eq!(verdict, String::from_str(&e, "ALLOW"));
}

#[test]
fn test_evaluate_warn() {
    let (e, client) = setup();
    let verdict = client.evaluate_score(&50);
    assert_eq!(verdict, String::from_str(&e, "WARN"));
}

#[test]
fn test_evaluate_block() {
    let (e, client) = setup();
    let verdict = client.evaluate_score(&85);
    assert_eq!(verdict, String::from_str(&e, "BLOCK"));
}

#[test]
fn test_set_policy() {
    let (_e, client) = setup();
    client.set_policy(&20, &60);
    let (low, medium) = client.get_thresholds();
    assert_eq!(low, 20);
    assert_eq!(medium, 60);
}

#[test]
#[should_panic(expected = "low must be less than medium")]
fn test_invalid_policy() {
    let (_e, client) = setup();
    client.set_policy(&70, &30);
}
