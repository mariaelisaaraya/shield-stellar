import express from "express";
import dotenv from "dotenv";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { execSync } from "child_process";
import { computeRiskScore, validateScoringInputs, VALID_ACTIONS } from "./risk-scoring.mjs";

dotenv.config();

const PORT = process.env.PORT || 3001;
const NETWORK = "stellar:testnet";
const FACILITATOR_URL = "https://www.x402.org/facilitator";
const PAY_TO = process.env.PAY_TO;

if (!PAY_TO) {
  console.error("ERROR: PAY_TO not set in .env — set your Stellar public key");
  process.exit(1);
}

// --- Contract IDs ---
const CONTRACTS = {
  agentRegistry: "CDWN6MDYAFTK5UNR64VD33IAR7LIU3S7LS262GHQCF3EJ3URJRKYMGB6",
  policyManager: "CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6",
  assessmentRegistry: "CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST",
};

// --- Soroban read helper ---
function contractRead(contractId, fn, args = "") {
  const cmd = `stellar contract invoke --id ${contractId} --network testnet --source deployer -- ${fn} ${args} 2>&1`;
  try {
    const output = execSync(cmd, { encoding: "utf-8", timeout: 15000 }).trim();
    const lines = output.split("\n");
    return lines.filter((l) => !l.startsWith("ℹ️") && !l.startsWith("⚠️")).join("\n").trim();
  } catch (err) {
    console.error(`contractRead(${fn}):`, err.message);
    throw err;
  }
}

const app = express();
app.use(express.json());

// --- CORS for frontend ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Expose-Headers", "PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// --- Info endpoint (free) ---
app.get("/", (_, res) => {
  res.json({
    name: "ShieldStellar x402 API",
    network: NETWORK,
    contracts: CONTRACTS,
    endpoints: {
      "POST /verdict": {
        price: "$0.001",
        description: "Server-side risk assessment. Score computed from inputs, not trusted from caller.",
        body: {
          target: "string — destination Stellar address (56 chars, starts with G)",
          amountUsd: "number — transaction value in USD",
          action: `string — one of: ${VALID_ACTIONS.join(", ")}`,
          isNewTarget: "boolean (optional, default true) — false if caller has verified prior interactions",
        },
      },
      "GET /stats": "$0.0005 — dashboard statistics",
      "GET /thresholds": "$0.0005 — policy thresholds",
    },
  });
});

// --- x402 payment middleware ---
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

app.use(
  paymentMiddlewareFromConfig(
    {
      "POST /verdict": {
        accepts: {
          scheme: "exact",
          price: "$0.001",
          network: NETWORK,
          payTo: PAY_TO,
        },
      },
      "GET /stats": {
        accepts: {
          scheme: "exact",
          price: "$0.0005",
          network: NETWORK,
          payTo: PAY_TO,
        },
      },
      "GET /thresholds": {
        accepts: {
          scheme: "exact",
          price: "$0.0005",
          network: NETWORK,
          payTo: PAY_TO,
        },
      },
    },
    facilitatorClient,
    [{ network: NETWORK, server: new ExactStellarScheme() }],
  ),
);

// --- Protected endpoints (require x402 payment) ---

app.post("/verdict", (req, res) => {
  // Reject legacy callers that try to pass a client-computed score.
  // The whole point of this endpoint is that the score is derived
  // server-side from verifiable inputs.
  if (req.body?.score !== undefined || req.query?.score !== undefined) {
    return res.status(400).json({
      error: "score is no longer accepted from callers — it is computed server-side from { target, amountUsd, action }",
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

    const result = contractRead(CONTRACTS.policyManager, "evaluate_score", `--score ${score}`);
    const verdict = result.replace(/"/g, "");

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
    console.error("[verdict] contract read failed:", err.message);
    res.status(500).json({ error: "Failed to evaluate score on-chain" });
  }
});

app.get("/stats", (_, res) => {
  try {
    const agentCount = parseInt(contractRead(CONTRACTS.agentRegistry, "get_agent_count")) || 0;
    const total = parseInt(contractRead(CONTRACTS.assessmentRegistry, "get_total_assessments")) || 0;

    let recent = [];
    const count = Math.min(total, 10);
    for (let i = total - 1; i >= total - count; i--) {
      try {
        const data = JSON.parse(contractRead(CONTRACTS.assessmentRegistry, "get_assessment", `--id ${i}`));
        recent.push({
          id: data.id,
          agent: data.agent,
          target: data.target,
          riskScore: data.risk_score,
          verdict: data.verdict,
          reason: data.reason,
          timestamp: data.timestamp,
        });
      } catch {}
    }

    const blocked = recent.filter((a) => a.verdict === "BLOCK").length;
    const avgScore = recent.length > 0
      ? Math.round(recent.reduce((s, a) => s + a.riskScore, 0) / recent.length)
      : 0;

    res.json({ agentCount, total, blocked, avgScore, recent });
  } catch {
    res.json({ agentCount: 0, total: 0, blocked: 0, avgScore: 0, recent: [] });
  }
});

app.get("/thresholds", (_, res) => {
  try {
    const result = JSON.parse(contractRead(CONTRACTS.policyManager, "get_thresholds"));
    res.json({ low: result[0], medium: result[1] });
  } catch {
    res.json({ low: 30, medium: 70 });
  }
});

app.listen(Number(PORT), () => {
  console.log(`\n  ShieldStellar x402 server`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Network: ${NETWORK}`);
  console.log(`  PayTo: ${PAY_TO}`);
  console.log(`  Facilitator: ${FACILITATOR_URL}\n`);
  console.log(`  Endpoints (x402 protected):`);
  console.log(`    POST /verdict         — $0.001  (body: { target, amountUsd, action })`);
  console.log(`    GET  /stats           — $0.0005`);
  console.log(`    GET  /thresholds      — $0.0005\n`);
});
