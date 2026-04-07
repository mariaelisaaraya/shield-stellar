#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{AgentRegistry, AgentRegistryClient};

fn setup() -> (Env, AgentRegistryClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let contract_id = e.register(AgentRegistry, (&owner,));
    let client = AgentRegistryClient::new(&e, &contract_id);
    (e, client, owner)
}

#[test]
fn test_register_agent() {
    let (e, client, _owner) = setup();
    let agent = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://QmTest123");

    client.register_agent(&agent, &uri);

    assert_eq!(client.get_agent_count(), 1);
    let info = client.get_agent(&agent);
    assert!(info.active);
    assert_eq!(info.metadata_uri, uri);
}

#[test]
fn test_toggle_agent() {
    let (e, client, _owner) = setup();
    let agent = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://QmTest123");

    client.register_agent(&agent, &uri);
    client.toggle_agent(&agent, &false);

    let info = client.get_agent(&agent);
    assert!(!info.active);
}

#[test]
#[should_panic(expected = "agent already registered")]
fn test_duplicate_registration() {
    let (e, client, _owner) = setup();
    let agent = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://QmTest123");

    client.register_agent(&agent, &uri);
    client.register_agent(&agent, &uri);
}
