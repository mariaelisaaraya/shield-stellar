#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Vec,
};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_macros::only_owner;

#[contracttype]
pub enum DataKey {
    AgentCount,
    Agent(Address),
    AgentList,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct AgentInfo {
    pub owner: Address,
    pub metadata_uri: String,
    pub active: bool,
    pub registered_at: u64,
}

#[contract]
pub struct AgentRegistry;

#[contractimpl]
impl AgentRegistry {
    pub fn __constructor(e: &Env, owner: Address) {
        set_owner(e, &owner);
        e.storage().instance().set(&DataKey::AgentCount, &0u32);
        let empty: Vec<Address> = Vec::new(e);
        e.storage().persistent().set(&DataKey::AgentList, &empty);
    }

    pub fn register_agent(e: &Env, agent: Address, metadata_uri: String) {
        agent.require_auth();

        if e.storage().persistent().has(&DataKey::Agent(agent.clone())) {
            panic!("agent already registered");
        }

        let info = AgentInfo {
            owner: agent.clone(),
            metadata_uri,
            active: true,
            registered_at: e.ledger().timestamp(),
        };

        e.storage().persistent().set(&DataKey::Agent(agent.clone()), &info);

        let mut list: Vec<Address> = e
            .storage()
            .persistent()
            .get(&DataKey::AgentList)
            .unwrap_or(Vec::new(e));
        list.push_back(agent);
        e.storage().persistent().set(&DataKey::AgentList, &list);

        let count: u32 = e.storage().instance().get(&DataKey::AgentCount).unwrap_or(0);
        e.storage().instance().set(&DataKey::AgentCount, &(count + 1));
    }

    #[only_owner]
    pub fn toggle_agent(e: &Env, agent: Address, active: bool) {
        let mut info: AgentInfo = e
            .storage()
            .persistent()
            .get(&DataKey::Agent(agent.clone()))
            .expect("agent not found");
        info.active = active;
        e.storage().persistent().set(&DataKey::Agent(agent), &info);
    }

    // --- Read functions (free on Stellar) ---

    pub fn get_agent(e: &Env, agent: Address) -> AgentInfo {
        e.storage()
            .persistent()
            .get(&DataKey::Agent(agent))
            .expect("agent not found")
    }

    pub fn get_agent_count(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::AgentCount).unwrap_or(0)
    }

    pub fn get_agents(e: &Env) -> Vec<Address> {
        e.storage()
            .persistent()
            .get(&DataKey::AgentList)
            .unwrap_or(Vec::new(e))
    }
}

#[contractimpl]
impl Ownable for AgentRegistry {}

#[cfg(test)]
mod test;
