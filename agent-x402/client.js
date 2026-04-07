import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { execSync } from "child_process";
import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

dotenv.config({
  path: fileURLToPath(new URL("./.env", import.meta.url)),
  quiet: true,
});

const STELLAR_PRIVATE_KEY = process.env.STELLAR_PRIVATE_KEY;
const SERVER_URL = process.env.SERVER_URL || "http://localhost:4002";
const NETWORK = "stellar:testnet";
const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";

const CONTRACTS = {
  assessmentRegistry: "CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST",
};

if (!STELLAR_PRIVATE_KEY) {
  console.error("ERROR: STELLAR_PRIVATE_KEY not set in .env");
  process.exit(1);
}

// --- Register assessment on-chain via Soroban ---
function registerAssessment(agentAddr, targetAddr, score, verdict, reason) {
  console.log("  Registering assessment on Soroban...");
  const cmd = `stellar contract invoke \
    --id ${CONTRACTS.assessmentRegistry} \
    --source agent-client \
    --network testnet \
    --send=yes \
    -- create_assessment \
    --agent ${agentAddr} \
    --target ${targetAddr} \
    --risk_score ${score} \
    --verdict "${verdict}" \
    --reason "${reason}"`;
  try {
    const output = execSync(cmd, { encoding: "utf-8", timeout: 30000 }).trim();
    const lines = output.split("\n").filter((l) => !l.startsWith("ℹ️") && !l.startsWith("⚠️"));
    console.log(`  Assessment registered on-chain (id: ${lines[lines.length - 1]})`);
    return true;
  } catch (err) {
    console.error("  Failed to register assessment:", err.message?.split("\n")[0]);
    return false;
  }
}

// --- x402 pay and fetch ---
async function payAndFetch(httpClient, client, endpoint) {
  const url = `${SERVER_URL}${endpoint}`;
  console.log(`\n→ GET ${url}`);

  const firstTry = await fetch(url);
  console.log(`  Status: ${firstTry.status}`);

  if (firstTry.status !== 402) {
    const body = await firstTry.text();
    console.log(`  Response: ${body}`);
    return null;
  }

  console.log("  Payment required — signing USDC transaction...");

  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => firstTry.headers.get(name),
  );

  let paymentPayload = await client.createPaymentPayload(paymentRequired);

  const networkPassphrase = getNetworkPassphrase(NETWORK);
  const tx = new Transaction(
    paymentPayload.payload.transaction,
    networkPassphrase,
  );
  const sorobanData = tx.toEnvelope().v1()?.tx()?.ext()?.sorobanData();

  if (sorobanData) {
    paymentPayload = {
      ...paymentPayload,
      payload: {
        ...paymentPayload.payload,
        transaction: TransactionBuilder.cloneFrom(tx, {
          fee: "1",
          sorobanData,
          networkPassphrase,
        })
          .build()
          .toXDR(),
      },
    };
  }

  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

  console.log("  Sending paid request...");
  const paidResponse = await fetch(url, {
    method: "GET",
    headers: paymentHeaders,
  });

  const body = await paidResponse.text();
  const paymentResponse = httpClient.getPaymentSettleResponse(
    (name) => paidResponse.headers.get(name),
  );

  console.log(`  Status: ${paidResponse.status}`);
  console.log(`  Response: ${body}`);
  if (paymentResponse) {
    console.log(`  Settlement tx: ${paymentResponse.transaction}`);
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== ShieldStellar x402 Agent ===\n");

  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = { url: STELLAR_RPC_URL };
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const httpClient = new x402HTTPClient(client);

  const agentAddr = signer.address;
  // Use deployer as target for demo assessments
  const targetAddr = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";

  console.log(`Agent: ${agentAddr}`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Network: ${NETWORK}`);

  // --- Assessment 1: Low risk transfer (score 25) ---
  console.log("\n━━━ Assessment 1: Low risk transfer ━━━");
  const verdict1 = await payAndFetch(httpClient, client, "/verdict?score=25");
  if (verdict1) {
    registerAssessment(agentAddr, targetAddr, 25, verdict1.verdict, "Low risk transfer to known address");
  }

  // --- Assessment 2: Medium risk swap (score 50) ---
  console.log("\n━━━ Assessment 2: Medium risk swap ━━━");
  const verdict2 = await payAndFetch(httpClient, client, "/verdict?score=50");
  if (verdict2) {
    registerAssessment(agentAddr, targetAddr, 50, verdict2.verdict, "Swap operation with elevated amount");
  }

  // --- Assessment 3: High risk contract call (score 85) ---
  console.log("\n━━━ Assessment 3: High risk contract call ━━━");
  const verdict3 = await payAndFetch(httpClient, client, "/verdict?score=85");
  if (verdict3) {
    registerAssessment(agentAddr, targetAddr, 85, verdict3.verdict, "Contract call to unknown address blocked");
  }

  console.log("\n=== Done ===");
  console.log(`Agent txs: https://stellar.expert/explorer/testnet/account/${agentAddr}`);
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
