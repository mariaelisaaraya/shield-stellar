// Shared x402 route handlers for ShieldStellar.
//
// Both server/server.js (standalone dev) and start.js (unified Render
// deploy) expose the same x402 endpoints — /verdict, /stats,
// /thresholds — but read the Soroban contracts through different
// mechanisms: the dev server shells out to the Stellar CLI, while the
// unified server talks to Soroban RPC directly via @stellar/stellar-sdk.
//
// Before this module, both files had their own copy of the handler
// logic. Keeping them in sync by hand was error-prone: any change to
// scoring, validation, or response shape had to be made twice, and
// dev and prod could silently drift.
//
// This module extracts the handler logic into a pure factory
// (createX402Handlers) that takes an `adapter` with the minimum set
// of async contract-read operations it needs. Each entry point
// supplies its own adapter; the handlers are identical.
//
// The adapter shape is the public contract of this module. If a
// handler needs a new on-chain read, add it here and update both
// adapters.

import { computeRiskScore, validateScoringInputs } from "./risk-scoring.mjs";

/**
 * @typedef {object} Assessment
 * @property {number} id
 * @property {string} agent
 * @property {string} target
 * @property {number} riskScore
 * @property {string} verdict
 * @property {string} reason
 * @property {number} timestamp
 */

/**
 * @typedef {object} X402Adapter
 * @property {(score: number) => Promise<string>} evaluateScore
 *           Calls PolicyManager.evaluate_score(score) and returns
 *           "ALLOW" | "WARN" | "BLOCK".
 * @property {() => Promise<number>} getAgentCount
 *           Calls AgentRegistry.get_agent_count().
 * @property {() => Promise<number>} getTotalAssessments
 *           Calls AssessmentRegistry.get_total_assessments().
 * @property {(id: number) => Promise<Assessment>} getAssessment
 *           Calls AssessmentRegistry.get_assessment(id) and returns
 *           the normalized shape (camelCase fields, numeric timestamp).
 * @property {() => Promise<[number, number]>} getThresholds
 *           Calls PolicyManager.get_thresholds() → [low, medium].
 */

/**
 * Build the three protected Express handlers from an adapter.
 *
 * @param {X402Adapter} adapter
 * @returns {{
 *   verdictHandler: import("express").RequestHandler,
 *   statsHandler: import("express").RequestHandler,
 *   thresholdsHandler: import("express").RequestHandler,
 * }}
 */
export function createX402Handlers(adapter) {
  return {
    verdictHandler: createVerdictHandler(adapter),
    statsHandler: createStatsHandler(adapter),
    thresholdsHandler: createThresholdsHandler(adapter),
  };
}

function createVerdictHandler({ evaluateScore }) {
  return async (req, res) => {
    // Reject legacy callers that try to pass a client-computed score.
    // The whole point of this endpoint is that the score is derived
    // server-side from verifiable inputs.
    if (req.body?.score !== undefined || req.query?.score !== undefined) {
      return res.status(400).json({
        error:
          "score is no longer accepted from callers — it is computed server-side from { target, amountUsd, action }",
      });
    }

    const { target, amountUsd, action, isNewTarget } = req.body ?? {};

    const validationError = validateScoringInputs({ target, amountUsd, action });
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const { score, reasons } = computeRiskScore({
        target,
        amountUsd,
        action,
        isNewTarget: isNewTarget ?? true,
      });

      const verdict = await evaluateScore(score);

      // Observability: log inputs + derived score + verdict for audit.
      console.log(
        `[verdict] target=${target} amountUsd=${amountUsd} action=${action} ` +
        `→ score=${score} verdict=${verdict}`,
      );

      res.json({
        verdict,
        score,
        reasons,
        inputs: { target, amountUsd, action, isNewTarget: isNewTarget ?? true },
      });
    } catch (err) {
      console.error("[verdict] contract call failed:", err?.message || err);
      res.status(500).json({ error: "Failed to evaluate score on-chain" });
    }
  };
}

function createStatsHandler({ getAgentCount, getTotalAssessments, getAssessment }) {
  return async (_req, res) => {
    try {
      const agentCount = await getAgentCount();
      const total = await getTotalAssessments();

      const recent = [];
      const count = Math.min(total, 10);
      for (let i = total - 1; i >= total - count; i--) {
        try {
          const assessment = await getAssessment(i);
          if (assessment) recent.push(assessment);
        } catch {
          // Individual assessment read failures are non-fatal; skip
          // the slot and continue building the recent list.
        }
      }

      const blocked = recent.filter((a) => a.verdict === "BLOCK").length;
      const avgScore =
        recent.length > 0
          ? Math.round(recent.reduce((s, a) => s + a.riskScore, 0) / recent.length)
          : 0;

      res.json({ agentCount, total, blocked, avgScore, recent });
    } catch {
      // Falling back to zeros keeps the dashboard alive during an
      // RPC outage. This mirrors the previous inline behavior.
      res.json({ agentCount: 0, total: 0, blocked: 0, avgScore: 0, recent: [] });
    }
  };
}

function createThresholdsHandler({ getThresholds }) {
  return async (_req, res) => {
    try {
      const [low, medium] = await getThresholds();
      res.json({ low, medium });
    } catch {
      // Fall back to the on-chain defaults so the UI stays rendered.
      res.json({ low: 30, medium: 70 });
    }
  };
}
