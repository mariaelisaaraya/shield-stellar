// Server-side risk scoring for ShieldStellar.
//
// This module is the single source of truth for how a numeric risk
// score is derived from a transaction's inputs. The x402 /verdict
// endpoint calls this function; callers (AI agents) cannot influence
// the score directly — only the inputs it's computed from.
//
// The function is pure: same inputs → same outputs. That makes it
// trivially safe for x402 retries and easy to test.

import { isRiskyAddress } from "./data/risky-addresses.mjs";

// Additive risk weight per action type.
// Transfers are the baseline (no extra risk beyond amount/target).
// Swaps and contract calls touch arbitrary code paths and carry more.
export const ACTION_RISK = {
  transfer: 0,
  swap: 10,
  "contract-call": 15,
  mint: 10,
  other: 5,
};

export const VALID_ACTIONS = Object.keys(ACTION_RISK);

// USD thresholds for amount-based scoring tiers.
export const AMOUNT_THRESHOLDS = {
  medium: 100,
  high: 1000,
};

// Score contribution constants.
const BASE_SCORE = 10;
const BLACKLIST_WEIGHT = 60;
const AMOUNT_HIGH_WEIGHT = 35;
const AMOUNT_MEDIUM_WEIGHT = 15;
const NEW_TARGET_WEIGHT = 15;

/**
 * Validate the inputs for computeRiskScore.
 * Returns an error string if invalid, null if ok.
 */
export function validateScoringInputs({ target, amountUsd, action }) {
  if (typeof target !== "string" || target.length === 0) {
    return "target must be a non-empty string (Stellar address)";
  }
  // Stellar public keys are 56-char base32 strings starting with G.
  // We don't fully validate the checksum here — that's the contract's job
  // if the target is ever used to sign. For risk scoring we only need a
  // well-formed string.
  if (!/^G[A-Z2-7]{55}$/.test(target)) {
    return "target must be a valid Stellar public key (56 chars, starts with G)";
  }
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd < 0) {
    return "amountUsd must be a non-negative finite number";
  }
  if (typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
    return `action must be one of: ${VALID_ACTIONS.join(", ")}`;
  }
  return null;
}

/**
 * Compute a risk score in [0, 100] from structured transaction inputs.
 *
 * @param {object} input
 * @param {string} input.target       Destination Stellar address.
 * @param {number} input.amountUsd    Transaction value in USD.
 * @param {string} input.action       One of VALID_ACTIONS.
 * @param {boolean} [input.isNewTarget=true]  True if the agent has no
 *        prior interaction history with this target. Defaults to true
 *        because most callers today can't verify history; pass false
 *        once you can.
 *
 * @returns {{ score: number, reasons: string[] }}
 */
export function computeRiskScore({ target, amountUsd, action, isNewTarget = true }) {
  let score = BASE_SCORE;
  const reasons = [];

  if (isRiskyAddress(target)) {
    score += BLACKLIST_WEIGHT;
    reasons.push("CRITICAL: target is on the known-risky address list");
  }

  if (amountUsd > AMOUNT_THRESHOLDS.high) {
    score += AMOUNT_HIGH_WEIGHT;
    reasons.push(`HIGH VALUE: $${amountUsd.toFixed(2)} USD (>$${AMOUNT_THRESHOLDS.high})`);
  } else if (amountUsd > AMOUNT_THRESHOLDS.medium) {
    score += AMOUNT_MEDIUM_WEIGHT;
    reasons.push(`MEDIUM VALUE: $${amountUsd.toFixed(2)} USD (>$${AMOUNT_THRESHOLDS.medium})`);
  } else {
    reasons.push(`Low value: $${amountUsd.toFixed(2)} USD`);
  }

  const actionRisk = ACTION_RISK[action] ?? ACTION_RISK.other;
  if (actionRisk > 0) {
    score += actionRisk;
    reasons.push(`Action "${action}" adds +${actionRisk} risk`);
  } else {
    reasons.push(`Action "${action}" is baseline risk`);
  }

  if (isNewTarget) {
    score += NEW_TARGET_WEIGHT;
    reasons.push("New target: no prior interaction history");
  }

  // Clamp to [0, 100] — PolicyManager expects a u32 in that range.
  const clamped = Math.min(100, Math.max(0, score));
  return { score: clamped, reasons };
}
