// Assertion-based tests for the server-side risk scoring engine.
// No test framework — just pure comparisons. Run with:
//
//   node server/test-scoring.mjs
//
// Exits with code 0 if every case passes, 1 otherwise.

import assert from "node:assert/strict";
import {
  computeRiskScore,
  validateScoringInputs,
  VALID_ACTIONS,
} from "./risk-scoring.mjs";

const CLEAN_TARGET = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
const RISKY_TARGET = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// Policy thresholds match the on-chain PolicyManager defaults
// (ALLOW < 30, WARN 30–69, BLOCK >= 70). Keep these in sync if the
// contract thresholds change.
function verdictFromScore(score) {
  if (score >= 70) return "BLOCK";
  if (score >= 30) return "WARN";
  return "ALLOW";
}

const cases = [
  {
    name: "low-value clean transfer → ALLOW",
    input: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" },
    // base 10 + amount 0 + action 0 + new target 15 = 25
    expected: { score: 25, verdict: "ALLOW" },
  },
  {
    name: "medium-value clean swap → WARN",
    input: { target: CLEAN_TARGET, amountUsd: 500, action: "swap" },
    // base 10 + amount 15 + action 10 + new target 15 = 50
    expected: { score: 50, verdict: "WARN" },
  },
  {
    name: "high-value blacklisted contract-call → BLOCK (clamped to 100)",
    input: { target: RISKY_TARGET, amountUsd: 5000, action: "contract-call" },
    // base 10 + blacklist 60 + amount 35 + action 15 + new target 15 = 135 → 100
    expected: { score: 100, verdict: "BLOCK" },
  },
  {
    name: "blacklisted tiny transfer, known target → still BLOCK (blacklist alone suffices)",
    input: {
      target: RISKY_TARGET,
      amountUsd: 1,
      action: "transfer",
      isNewTarget: false,
    },
    // base 10 + blacklist 60 + 0 + 0 + 0 = 70
    expected: { score: 70, verdict: "BLOCK" },
  },
  {
    name: "zero-amount clean transfer → ALLOW",
    input: { target: CLEAN_TARGET, amountUsd: 0, action: "transfer" },
    // base 10 + 0 + 0 + new target 15 = 25
    expected: { score: 25, verdict: "ALLOW" },
  },
  {
    name: "known target, small swap → ALLOW (no new-target penalty)",
    input: {
      target: CLEAN_TARGET,
      amountUsd: 50,
      action: "swap",
      isNewTarget: false,
    },
    // base 10 + 0 + 10 + 0 = 20
    expected: { score: 20, verdict: "ALLOW" },
  },
];

let failures = 0;
for (const c of cases) {
  try {
    const validationError = validateScoringInputs(c.input);
    assert.equal(validationError, null, `validation failed: ${validationError}`);

    const { score, reasons } = computeRiskScore(c.input);
    assert.equal(score, c.expected.score, `score mismatch`);
    assert.equal(verdictFromScore(score), c.expected.verdict, `verdict mismatch`);
    assert.ok(reasons.length > 0, "reasons must not be empty");

    console.log(`  ok   ${c.name} → score=${score} verdict=${c.expected.verdict}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${c.name}`);
    console.error(`       ${err.message}`);
  }
}

// --- Validation tests ---

const validationCases = [
  {
    name: "rejects missing target",
    input: { amountUsd: 10, action: "transfer" },
    expectError: true,
  },
  {
    name: "rejects non-Stellar target",
    input: { target: "0xdeadbeef", amountUsd: 10, action: "transfer" },
    expectError: true,
  },
  {
    name: "rejects negative amount",
    input: { target: CLEAN_TARGET, amountUsd: -5, action: "transfer" },
    expectError: true,
  },
  {
    name: "rejects unknown action",
    input: { target: CLEAN_TARGET, amountUsd: 10, action: "nuclear" },
    expectError: true,
  },
  {
    name: "accepts every valid action",
    input: { target: CLEAN_TARGET, amountUsd: 10 },
    expectError: false,
    perAction: true,
  },
];

for (const c of validationCases) {
  if (c.perAction) {
    let ok = true;
    for (const action of VALID_ACTIONS) {
      const err = validateScoringInputs({ ...c.input, action });
      if (err !== null) {
        ok = false;
        console.error(`  FAIL ${c.name}: action "${action}" rejected (${err})`);
        failures++;
        break;
      }
    }
    if (ok) console.log(`  ok   ${c.name}`);
    continue;
  }

  const err = validateScoringInputs(c.input);
  const gotError = err !== null;
  if (gotError === c.expectError) {
    console.log(`  ok   ${c.name}${gotError ? ` → "${err}"` : ""}`);
  } else {
    failures++;
    console.error(`  FAIL ${c.name}: expected error=${c.expectError}, got ${gotError ? `"${err}"` : "no error"}`);
  }
}

console.log("");
if (failures === 0) {
  console.log(`All ${cases.length + validationCases.length} test cases passed.`);
  process.exit(0);
} else {
  console.error(`${failures} test case(s) failed.`);
  process.exit(1);
}
