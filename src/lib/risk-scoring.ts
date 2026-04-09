// Server-side risk scoring for ShieldStellar (Next.js API route).
//
// Mirror of server/risk-scoring.mjs. Both paths (Express x402 server
// and Next.js API route) share the same scoring logic so verdicts
// are consistent regardless of which entry point the caller hits.
// Keep this file and server/risk-scoring.mjs in sync.

import { isRiskyAddress } from "./risky-addresses";

export type RiskAction = "transfer" | "swap" | "contract-call" | "mint" | "other";

export const ACTION_RISK: Record<RiskAction, number> = {
  transfer: 0,
  swap: 10,
  "contract-call": 15,
  mint: 10,
  other: 5,
};

export const VALID_ACTIONS: RiskAction[] = Object.keys(ACTION_RISK) as RiskAction[];

export const AMOUNT_THRESHOLDS = {
  medium: 100,
  high: 1000,
};

const BASE_SCORE = 10;
const BLACKLIST_WEIGHT = 60;
const AMOUNT_HIGH_WEIGHT = 35;
const AMOUNT_MEDIUM_WEIGHT = 15;
const NEW_TARGET_WEIGHT = 15;

export interface ScoringInputs {
  target: string;
  amountUsd: number;
  action: RiskAction;
  isNewTarget?: boolean;
}

export interface ScoringResult {
  score: number;
  reasons: string[];
}

export function validateScoringInputs(input: {
  target: unknown;
  amountUsd: unknown;
  action: unknown;
}): string | null {
  const { target, amountUsd, action } = input;
  if (typeof target !== "string" || target.length === 0) {
    return "target must be a non-empty string (Stellar address)";
  }
  if (!/^G[A-Z2-7]{55}$/.test(target)) {
    return "target must be a valid Stellar public key (56 chars, starts with G)";
  }
  if (typeof amountUsd !== "number" || !Number.isFinite(amountUsd) || amountUsd < 0) {
    return "amountUsd must be a non-negative finite number";
  }
  if (typeof action !== "string" || !(VALID_ACTIONS as string[]).includes(action)) {
    return `action must be one of: ${VALID_ACTIONS.join(", ")}`;
  }
  return null;
}

/**
 * Compute a risk score in [0, 100] from structured transaction inputs.
 * Pure function — same inputs produce the same score and reasons.
 */
export function computeRiskScore({
  target,
  amountUsd,
  action,
  isNewTarget = true,
}: ScoringInputs): ScoringResult {
  let score = BASE_SCORE;
  const reasons: string[] = [];

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

  const clamped = Math.min(100, Math.max(0, score));
  return { score: clamped, reasons };
}
