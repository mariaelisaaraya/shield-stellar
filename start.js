// Unified server: Next.js frontend + x402 Express API
// Uses Soroban RPC HTTP (no CLI dependency)

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import * as StellarSdk from "@stellar/stellar-sdk";

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "3000", 10);
const NETWORK = "stellar:testnet";
const FACILITATOR_URL = "https://www.x402.org/facilitator";
const PAY_TO = process.env.PAY_TO || "";
const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

const CONTRACTS = {
  agentRegistry: "CDWN6MDYAFTK5UNR64VD33IAR7LIU3S7LS262GHQCF3EJ3URJRKYMGB6",
  policyManager: "CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6",
  assessmentRegistry: "CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST",
};

const DEPLOYER = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";

// --- Soroban RPC read helper ---
function getRpcServer() {
  return new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
}

async function contractCall(contractId, method, args = []) {
  const server = getRpcServer();
  const contract = new StellarSdk.Contract(contractId);
  const sourceAccount = await server.getAccount(DEPLOYER).catch(
    () => new StellarSdk.Account(DEPLOYER, "0")
  );
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error("Simulation error");
  if (!StellarSdk.rpc.Api.isSimulationSuccess(sim)) throw new Error("Simulation failed");
  return StellarSdk.scValToNative(sim.result.retval);
}

// --- x402 Express router (mounted at /x402) ---
const x402Router = express.Router();

// Info endpoint (free, no payment needed)
x402Router.get("/", (_, res) => {
  res.json({ name: "ShieldStellar x402 API", network: NETWORK, contracts: CONTRACTS });
});

// x402 payment middleware — gates all routes below
if (PAY_TO) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
  x402Router.use(
    paymentMiddlewareFromConfig(
      {
        "GET /verdict": { accepts: { scheme: "exact", price: "$0.001", network: NETWORK, payTo: PAY_TO } },
        "GET /stats": { accepts: { scheme: "exact", price: "$0.0005", network: NETWORK, payTo: PAY_TO } },
        "GET /thresholds": { accepts: { scheme: "exact", price: "$0.0005", network: NETWORK, payTo: PAY_TO } },
      },
      facilitatorClient,
      [{ network: NETWORK, server: new ExactStellarScheme() }],
    ),
  );
}

// Protected endpoints
x402Router.get("/verdict", async (req, res) => {
  try {
    const score = parseInt(req.query.score) || 0;
    const args = [StellarSdk.nativeToScVal(score, { type: "u32" })];
    const verdict = await contractCall(CONTRACTS.policyManager, "evaluate_score", args);
    res.json({ verdict, score });
  } catch { res.status(500).json({ error: "Failed to evaluate score" }); }
});

x402Router.get("/stats", async (_, res) => {
  try {
    const agentCount = await contractCall(CONTRACTS.agentRegistry, "get_agent_count");
    const total = await contractCall(CONTRACTS.assessmentRegistry, "get_total_assessments");
    let recent = [];
    const count = Math.min(total, 10);
    for (let i = total - 1; i >= total - count; i--) {
      try {
        const args = [StellarSdk.nativeToScVal(i, { type: "u32" })];
        const data = await contractCall(CONTRACTS.assessmentRegistry, "get_assessment", args);
        recent.push({ id: data.id, agent: data.agent, target: data.target, riskScore: data.risk_score, verdict: data.verdict, reason: data.reason, timestamp: Number(data.timestamp) });
      } catch {}
    }
    const blocked = recent.filter((a) => a.verdict === "BLOCK").length;
    const avgScore = recent.length > 0 ? Math.round(recent.reduce((s, a) => s + a.riskScore, 0) / recent.length) : 0;
    res.json({ agentCount, total, blocked, avgScore, recent });
  } catch { res.json({ agentCount: 0, total: 0, blocked: 0, avgScore: 0, recent: [] }); }
});

x402Router.get("/thresholds", async (_, res) => {
  try {
    const result = await contractCall(CONTRACTS.policyManager, "get_thresholds");
    res.json({ low: result[0], medium: result[1] });
  } catch { res.json({ low: 30, medium: 70 }); }
});

// --- Main Express app ---
const expressApp = express();
expressApp.use(express.json());
expressApp.use((req, res, nxt) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Expose-Headers", "PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  nxt();
});
expressApp.use("/x402", x402Router);

// --- Next.js app ---
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname?.startsWith("/x402")) {
      expressApp(req, res);
      return;
    }
    handle(req, res, parsedUrl);
  });

  server.listen(PORT, () => {
    console.log(`\n  ShieldStellar`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  x402 API: /x402/*`);
    console.log(`  Network: ${NETWORK}`);
    console.log(`  PAY_TO: ${PAY_TO || "(not set — x402 gate disabled)"}\n`);
  });
});
