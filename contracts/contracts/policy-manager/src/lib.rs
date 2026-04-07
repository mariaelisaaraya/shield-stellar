#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_macros::only_owner;

#[contracttype]
pub enum DataKey {
    LowThreshold,
    MediumThreshold,
}

#[contract]
pub struct PolicyManager;

#[contractimpl]
impl PolicyManager {
    pub fn __constructor(e: &Env, owner: Address, low: u32, medium: u32) {
        set_owner(e, &owner);
        e.storage().instance().set(&DataKey::LowThreshold, &low);
        e.storage().instance().set(&DataKey::MediumThreshold, &medium);
    }

    #[only_owner]
    pub fn set_policy(e: &Env, low: u32, medium: u32) {
        if low >= medium {
            panic!("low must be less than medium");
        }
        e.storage().instance().set(&DataKey::LowThreshold, &low);
        e.storage().instance().set(&DataKey::MediumThreshold, &medium);
    }

    // --- Read functions (free on Stellar) ---

    pub fn get_thresholds(e: &Env) -> (u32, u32) {
        let low: u32 = e.storage().instance().get(&DataKey::LowThreshold).unwrap_or(30);
        let medium: u32 = e.storage().instance().get(&DataKey::MediumThreshold).unwrap_or(70);
        (low, medium)
    }

    pub fn evaluate_score(e: &Env, score: u32) -> String {
        let (low, medium) = Self::get_thresholds(e);
        if score >= medium {
            String::from_str(e, "BLOCK")
        } else if score >= low {
            String::from_str(e, "WARN")
        } else {
            String::from_str(e, "ALLOW")
        }
    }
}

#[contractimpl]
impl Ownable for PolicyManager {}

#[cfg(test)]
mod test;
