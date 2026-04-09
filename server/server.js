import express from "express";
import dotenv from "dotenv";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { execSync } from "child_process";
import { VALID_ACTIONS } from "./risk-scoring.mjs";
import { createX402Handlers } from "./x402-routes.mjs";

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

// --- Soroban read helper (CLI) ---
// The standalone dev server shells out to the Stellar CLI because it
// doesn't assume the caller already has a configured RPC client. The
// start.js path talks directly to Soroban RPC.
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

// --- Adapter: translates the shared X402Adapter interface to CLI calls ---
const cliAdapter = {
  async evaluateScore(score) {
    const raw = contractRead(CONTRACTS.policyManager, "evaluate_score", `--score ${score}`);
    return raw.replace(/"/g, "");
  },
  async getAgentCount() {
    return parseInt(contractRead(CONTRACTS.agentRegistry, "get_agent_count")) || 0;
  },
  async getTotalAssessments() {
    return parseInt(contractRead(CONTRACTS.assessmentRegistry, "get_total_assessments")) || 0;
  },
  async getAssessment(id) {
    const data = JSON.parse(
      contractRead(CONTRACTS.assessmentRegistry, "get_assessment", `--id ${id}`),
    );
    return {
      id: data.id,
      agent: data.agent,
      target: data.target,
      riskScore: data.risk_score,
      verdict: data.verdict,
      reason: data.reason,
      timestamp: data.timestamp,
    };
  },
  async getThresholds() {
    const result = JSON.parse(contractRead(CONTRACTS.policyManager, "get_thresholds"));
    return [result[0], result[1]];
  },
};

const { verdictHandler, statsHandler, thresholdsHandler } = createX402Handlers(cliAdapter);

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
// Handlers come from server/x402-routes.mjs so server.js and start.js
// share identical request/response logic. This file only supplies the
// CLI-based contract adapter above.
app.post("/verdict", verdictHandler);
app.get("/stats", statsHandler);
app.get("/thresholds", thresholdsHandler);

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
