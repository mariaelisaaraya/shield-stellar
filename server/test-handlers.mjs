// Handler composition tests for the shared x402 routes factory.
//
// These tests verify that createX402Handlers wires the adapter
// correctly and preserves the behavior that server/server.js and
// start.js used to implement inline. They use a fake Express
// request/response harness — no real HTTP server, no real Stellar RPC.
//
// Run with:
//
//   node server/test-handlers.mjs
//
// Exits 0 if all cases pass, 1 otherwise.

import assert from "node:assert/strict";
import { createX402Handlers } from "./x402-routes.mjs";

const CLEAN_TARGET = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
const RISKY_TARGET = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// --- Fake Express req/res harness ---
function fakeReq({ body, query } = {}) {
  return { body: body ?? {}, query: query ?? {} };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

// --- Mock adapter that records what the handlers asked for ---
function mockAdapter(overrides = {}) {
  const calls = {
    evaluateScore: [],
    getAgentCount: 0,
    getTotalAssessments: 0,
    getAssessment: [],
    getThresholds: 0,
  };

  const base = {
    async evaluateScore(score) {
      calls.evaluateScore.push(score);
      if (score >= 70) return "BLOCK";
      if (score >= 30) return "WARN";
      return "ALLOW";
    },
    async getAgentCount() {
      calls.getAgentCount++;
      return 3;
    },
    async getTotalAssessments() {
      calls.getTotalAssessments++;
      return 2;
    },
    async getAssessment(id) {
      calls.getAssessment.push(id);
      return {
        id,
        agent: CLEAN_TARGET,
        target: CLEAN_TARGET,
        riskScore: id === 0 ? 25 : 85,
        verdict: id === 0 ? "ALLOW" : "BLOCK",
        reason: "mock",
        timestamp: 1_700_000_000 + id,
      };
    },
    async getThresholds() {
      calls.getThresholds++;
      return [30, 70];
    },
  };

  return { adapter: { ...base, ...overrides }, calls };
}

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

// --- /verdict happy path: low risk → ALLOW ---
await checkAsync("verdictHandler — low risk clean transfer → ALLOW", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "ALLOW");
  assert.equal(res.body.score, 25);
  assert.ok(Array.isArray(res.body.reasons) && res.body.reasons.length > 0);
  assert.deepEqual(res.body.inputs, {
    target: CLEAN_TARGET,
    amountUsd: 5,
    action: "transfer",
    isNewTarget: true,
  });
  // The handler must have called the adapter with the derived score,
  // not with anything from the request body.
  assert.deepEqual(calls.evaluateScore, [25]);
});

// --- /verdict blacklisted target → BLOCK ---
await checkAsync("verdictHandler — blacklisted target clamps to BLOCK", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: RISKY_TARGET, amountUsd: 5000, action: "contract-call" },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.verdict, "BLOCK");
  assert.equal(res.body.score, 100);
  assert.deepEqual(calls.evaluateScore, [100]);
});

// --- /verdict rejects legacy ?score= body ---
await checkAsync("verdictHandler — rejects legacy score in body", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer", score: 0 },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /score is no longer accepted/);
  // Adapter must not have been called — the rejection is early.
  assert.equal(calls.evaluateScore.length, 0);
});

// --- /verdict rejects legacy ?score= query param ---
await checkAsync("verdictHandler — rejects legacy score in query", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" },
    query: { score: "50" },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.evaluateScore.length, 0);
});

// --- /verdict validates the target format ---
await checkAsync("verdictHandler — rejects malformed target", async () => {
  const { adapter } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: "0xdeadbeef", amountUsd: 5, action: "transfer" },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid Stellar public key/);
});

// --- /verdict surfaces adapter failures as 500 ---
await checkAsync("verdictHandler — adapter throw → 500", async () => {
  const { adapter } = mockAdapter({
    async evaluateScore() {
      throw new Error("rpc down");
    },
  });
  const { verdictHandler } = createX402Handlers(adapter);

  const req = fakeReq({
    body: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" },
  });
  const res = fakeRes();
  await verdictHandler(req, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /Failed to evaluate score/);
});

// --- /stats aggregates adapter data ---
await checkAsync("statsHandler — aggregates assessments and metrics", async () => {
  const { adapter, calls } = mockAdapter();
  const { statsHandler } = createX402Handlers(adapter);

  const req = fakeReq();
  const res = fakeRes();
  await statsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.agentCount, 3);
  assert.equal(res.body.total, 2);
  assert.equal(res.body.recent.length, 2);
  assert.equal(res.body.blocked, 1);  // one BLOCK in the mock
  assert.equal(res.body.avgScore, 55); // (85 + 25) / 2 rounded
  assert.equal(calls.getAgentCount, 1);
  assert.equal(calls.getTotalAssessments, 1);
  assert.equal(calls.getAssessment.length, 2);
});

// --- /stats falls back to zeros on total fetch failure ---
await checkAsync("statsHandler — falls back to zeros on error", async () => {
  const { adapter } = mockAdapter({
    async getTotalAssessments() {
      throw new Error("rpc down");
    },
  });
  const { statsHandler } = createX402Handlers(adapter);

  const req = fakeReq();
  const res = fakeRes();
  await statsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    agentCount: 0, total: 0, blocked: 0, avgScore: 0, recent: [],
  });
});

// --- /stats tolerates individual assessment failures ---
await checkAsync("statsHandler — skips individual assessment errors", async () => {
  let i = 0;
  const { adapter } = mockAdapter({
    async getAssessment(id) {
      i++;
      if (i === 1) throw new Error("missing");
      return {
        id,
        agent: CLEAN_TARGET,
        target: CLEAN_TARGET,
        riskScore: 40,
        verdict: "WARN",
        reason: "ok",
        timestamp: 1,
      };
    },
  });
  const { statsHandler } = createX402Handlers(adapter);

  const req = fakeReq();
  const res = fakeRes();
  await statsHandler(req, res);

  assert.equal(res.statusCode, 200);
  // total is 2, one assessment read throws, one succeeds
  assert.equal(res.body.recent.length, 1);
  assert.equal(res.body.recent[0].verdict, "WARN");
});

// --- /thresholds happy path ---
await checkAsync("thresholdsHandler — returns low/medium", async () => {
  const { adapter, calls } = mockAdapter();
  const { thresholdsHandler } = createX402Handlers(adapter);

  const req = fakeReq();
  const res = fakeRes();
  await thresholdsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { low: 30, medium: 70 });
  assert.equal(calls.getThresholds, 1);
});

// --- /thresholds falls back to defaults on error ---
await checkAsync("thresholdsHandler — falls back to defaults on error", async () => {
  const { adapter } = mockAdapter({
    async getThresholds() {
      throw new Error("rpc down");
    },
  });
  const { thresholdsHandler } = createX402Handlers(adapter);

  const req = fakeReq();
  const res = fakeRes();
  await thresholdsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { low: 30, medium: 70 });
});

console.log("");
if (failures === 0) {
  console.log("All handler test cases passed.");
  process.exit(0);
} else {
  console.error(`${failures} handler test case(s) failed.`);
  process.exit(1);
}
