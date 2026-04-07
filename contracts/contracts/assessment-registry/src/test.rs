#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{AssessmentRegistry, AssessmentRegistryClient};

fn setup() -> (Env, AssessmentRegistryClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let owner = Address::generate(&e);
    let contract_id = e.register(AssessmentRegistry, (&owner,));
    let client = AssessmentRegistryClient::new(&e, &contract_id);
    (e, client, owner)
}

#[test]
fn test_create_assessment() {
    let (e, client, _owner) = setup();
    let agent = Address::generate(&e);
    let target = Address::generate(&e);

    let id = client.create_assessment(
        &agent,
        &target,
        &25,
        &String::from_str(&e, "ALLOW"),
        &String::from_str(&e, "Low risk transaction"),
    );

    assert_eq!(id, 0);
    assert_eq!(client.get_total_assessments(), 1);

    let assessment = client.get_assessment(&0);
    assert_eq!(assessment.risk_score, 25);
    assert_eq!(assessment.verdict, String::from_str(&e, "ALLOW"));
}

#[test]
fn test_multiple_assessments() {
    let (e, client, _owner) = setup();
    let agent = Address::generate(&e);
    let target1 = Address::generate(&e);
    let target2 = Address::generate(&e);

    client.create_assessment(
        &agent,
        &target1,
        &25,
        &String::from_str(&e, "ALLOW"),
        &String::from_str(&e, "Safe"),
    );
    client.create_assessment(
        &agent,
        &target2,
        &80,
        &String::from_str(&e, "BLOCK"),
        &String::from_str(&e, "High risk"),
    );

    assert_eq!(client.get_total_assessments(), 2);

    let agent_ids = client.get_assessments_by_agent(&agent);
    assert_eq!(agent_ids.len(), 2);
}
