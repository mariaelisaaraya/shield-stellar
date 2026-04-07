#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};
use stellar_access::ownable::{set_owner, Ownable};

#[contracttype]
pub enum DataKey {
    TotalAssessments,
    Assessment(u32),
    AgentAssessments(Address),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Assessment {
    pub id: u32,
    pub agent: Address,
    pub target: Address,
    pub risk_score: u32,
    pub verdict: String,
    pub reason: String,
    pub timestamp: u64,
}

#[contract]
pub struct AssessmentRegistry;

#[contractimpl]
impl AssessmentRegistry {
    pub fn __constructor(e: &Env, owner: Address) {
        set_owner(e, &owner);
        e.storage().instance().set(&DataKey::TotalAssessments, &0u32);
    }

    pub fn create_assessment(
        e: &Env,
        agent: Address,
        target: Address,
        risk_score: u32,
        verdict: String,
        reason: String,
    ) -> u32 {
        agent.require_auth();

        let id: u32 = e
            .storage()
            .instance()
            .get(&DataKey::TotalAssessments)
            .unwrap_or(0);

        let assessment = Assessment {
            id,
            agent: agent.clone(),
            target,
            risk_score,
            verdict,
            reason,
            timestamp: e.ledger().timestamp(),
        };

        e.storage()
            .persistent()
            .set(&DataKey::Assessment(id), &assessment);

        // Track per-agent assessments
        let mut agent_ids: Vec<u32> = e
            .storage()
            .persistent()
            .get(&DataKey::AgentAssessments(agent.clone()))
            .unwrap_or(Vec::new(e));
        agent_ids.push_back(id);
        e.storage()
            .persistent()
            .set(&DataKey::AgentAssessments(agent), &agent_ids);

        e.storage()
            .instance()
            .set(&DataKey::TotalAssessments, &(id + 1));

        id
    }

    // --- Read functions (free on Stellar) ---

    pub fn get_assessment(e: &Env, id: u32) -> Assessment {
        e.storage()
            .persistent()
            .get(&DataKey::Assessment(id))
            .expect("assessment not found")
    }

    pub fn get_total_assessments(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::TotalAssessments)
            .unwrap_or(0)
    }

    pub fn get_assessments_by_agent(e: &Env, agent: Address) -> Vec<u32> {
        e.storage()
            .persistent()
            .get(&DataKey::AgentAssessments(agent))
            .unwrap_or(Vec::new(e))
    }
}

#[contractimpl]
impl Ownable for AssessmentRegistry {}

#[cfg(test)]
mod test;
