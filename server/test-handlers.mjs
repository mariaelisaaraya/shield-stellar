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
import { createIdempotencyCache } from "./idempotency-cache.mjs";

const CLEAN_TARGET = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
const RISKY_TARGET = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// --- Fake Express req/res harness ---
function fakeReq({ body, query, headers } = {}) {
  return {
    body: body ?? {},
    query: query ?? {},
    headers: headers ?? {},
  };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
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

// --- Idempotency cache tests ---------------------------------------------

// Same key + same body → cache hit: adapter called only once, response
// replayed verbatim, replay header set.
await checkAsync("idempotency — same key + same body replays", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };
  const headers = { "idempotency-key": "req-abc-1" };

  const res1 = fakeRes();
  await verdictHandler(fakeReq({ body, headers }), res1);

  const res2 = fakeRes();
  await verdictHandler(fakeReq({ body, headers }), res2);

  assert.equal(res1.statusCode, 200);
  assert.equal(res2.statusCode, 200);
  assert.deepEqual(res2.body, res1.body);
  assert.equal(res2.headers["X-Idempotent-Replay"], "true");
  assert.equal(res1.headers["X-Idempotent-Replay"], undefined);
  // Adapter called exactly once — the second call was served from cache.
  assert.equal(calls.evaluateScore.length, 1);
});

// Same key + different body → 409 Conflict (Stripe/GitHub convention).
await checkAsync("idempotency — same key + different body → 409", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const headers = { "idempotency-key": "req-abc-2" };

  const res1 = fakeRes();
  await verdictHandler(
    fakeReq({
      body: { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" },
      headers,
    }),
    res1,
  );

  const res2 = fakeRes();
  await verdictHandler(
    fakeReq({
      body: { target: CLEAN_TARGET, amountUsd: 5000, action: "swap" },
      headers,
    }),
    res2,
  );

  assert.equal(res1.statusCode, 200);
  assert.equal(res2.statusCode, 409);
  assert.match(res2.body.error, /different request inputs/);
  // Adapter was called for the first request only.
  assert.equal(calls.evaluateScore.length, 1);
});

// Different keys → independent computations.
await checkAsync("idempotency — different keys are independent", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };

  await verdictHandler(
    fakeReq({ body, headers: { "idempotency-key": "key-A" } }),
    fakeRes(),
  );
  await verdictHandler(
    fakeReq({ body, headers: { "idempotency-key": "key-B" } }),
    fakeRes(),
  );

  // Two different keys → two adapter calls even though inputs match.
  assert.equal(calls.evaluateScore.length, 2);
});

// No Idempotency-Key → no caching at all.
await checkAsync("idempotency — no key → every request recomputes", async () => {
  const { adapter, calls } = mockAdapter();
  const { verdictHandler } = createX402Handlers(adapter);

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };

  for (let i = 0; i < 3; i++) {
    await verdictHandler(fakeReq({ body }), fakeRes());
  }

  assert.equal(calls.evaluateScore.length, 3);
});

// Entry expires after TTL elapses → recompute on next call.
await checkAsync("idempotency — expired entry recomputes", async () => {
  const { adapter, calls } = mockAdapter();

  // Controllable clock: start at t=0, tick forward between calls.
  let fakeNow = 1_000_000;
  const cache = createIdempotencyCache({
    ttlMs: 1000,
    maxEntries: 100,
    now: () => fakeNow,
  });
  const { verdictHandler } = createX402Handlers(adapter, { idempotencyCache: cache });

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };
  const headers = { "idempotency-key": "key-ttl" };

  await verdictHandler(fakeReq({ body, headers }), fakeRes());
  // Advance past the TTL.
  fakeNow += 2000;
  await verdictHandler(fakeReq({ body, headers }), fakeRes());

  // Adapter called twice because the first entry expired.
  assert.equal(calls.evaluateScore.length, 2);
});

// Failed (non-200) responses are not cached — a retry should have a
// chance to succeed if the underlying RPC recovers.
await checkAsync("idempotency — 500 responses are not cached", async () => {
  let failures = 1;
  const { adapter, calls } = mockAdapter({
    async evaluateScore(score) {
      calls.evaluateScore.push(score);
      if (failures > 0) {
        failures--;
        throw new Error("rpc flap");
      }
      return "ALLOW";
    },
  });
  const { verdictHandler } = createX402Handlers(adapter);

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };
  const headers = { "idempotency-key": "key-retry" };

  const res1 = fakeRes();
  await verdictHandler(fakeReq({ body, headers }), res1);
  assert.equal(res1.statusCode, 500);

  const res2 = fakeRes();
  await verdictHandler(fakeReq({ body, headers }), res2);
  // Second call should have hit the adapter again and succeeded.
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.body.verdict, "ALLOW");
});

// LRU eviction keeps cache bounded.
await checkAsync("idempotency — cache evicts oldest at maxEntries", async () => {
  const { adapter } = mockAdapter();
  const cache = createIdempotencyCache({ maxEntries: 2, now: Date.now });
  const { verdictHandler } = createX402Handlers(adapter, { idempotencyCache: cache });

  const body = { target: CLEAN_TARGET, amountUsd: 5, action: "transfer" };

  await verdictHandler(fakeReq({ body, headers: { "idempotency-key": "k1" } }), fakeRes());
  await verdictHandler(fakeReq({ body, headers: { "idempotency-key": "k2" } }), fakeRes());
  await verdictHandler(fakeReq({ body, headers: { "idempotency-key": "k3" } }), fakeRes());

  assert.equal(cache.size(), 2);
});

console.log("");
if (failures === 0) {
  console.log("All handler test cases passed.");
  process.exit(0);
} else {
  console.error(`${failures} handler test case(s) failed.`);
  process.exit(1);
}
