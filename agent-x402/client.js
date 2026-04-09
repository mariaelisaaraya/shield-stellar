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
//
// Posts a JSON body to an x402-protected endpoint. Handles the 402
// dance: probe → sign USDC payment → retry with PAYMENT-SIGNATURE.
async function payAndPost(httpClient, client, endpoint, jsonBody) {
  const url = `${SERVER_URL}${endpoint}`;
  console.log(`\n→ POST ${url}`);
  console.log(`  Body: ${JSON.stringify(jsonBody)}`);

  const bodyString = JSON.stringify(jsonBody);
  const baseHeaders = { "Content-Type": "application/json" };

  const firstTry = await fetch(url, {
    method: "POST",
    headers: baseHeaders,
    body: bodyString,
  });
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
    method: "POST",
    headers: { ...baseHeaders, ...paymentHeaders },
    body: bodyString,
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
  // A clean demo target (the deployer address) for the low/medium scenarios.
  const cleanTarget = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
  // An address on the server's known-risky list (see server/data/risky-addresses.mjs).
  // Using this as the target must push the score past the BLOCK threshold.
  const riskyTarget = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

  console.log(`Agent: ${agentAddr}`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Network: ${NETWORK}`);

  // Each scenario sends structured inputs to the server. The server
  // derives the risk score, calls PolicyManager for the verdict, and
  // returns both along with human-readable reasons. The client no
  // longer guesses the score.

  // --- Assessment 1: Low risk transfer ---
  console.log("\n━━━ Assessment 1: Low-value transfer to a clean target ━━━");
  const verdict1 = await payAndPost(httpClient, client, "/verdict", {
    target: cleanTarget,
    amountUsd: 5,
    action: "transfer",
  });
  if (verdict1) {
    registerAssessment(
      agentAddr,
      cleanTarget,
      verdict1.score,
      verdict1.verdict,
      verdict1.reasons?.[0] ?? "Low risk transfer",
    );
  }

  // --- Assessment 2: Medium-value swap ---
  console.log("\n━━━ Assessment 2: Medium-value swap to a clean target ━━━");
  const verdict2 = await payAndPost(httpClient, client, "/verdict", {
    target: cleanTarget,
    amountUsd: 500,
    action: "swap",
  });
  if (verdict2) {
    registerAssessment(
      agentAddr,
      cleanTarget,
      verdict2.score,
      verdict2.verdict,
      verdict2.reasons?.[0] ?? "Swap at elevated amount",
    );
  }

  // --- Assessment 3: High-risk contract call to blacklisted target ---
  console.log("\n━━━ Assessment 3: Contract call to blacklisted address ━━━");
  const verdict3 = await payAndPost(httpClient, client, "/verdict", {
    target: riskyTarget,
    amountUsd: 5000,
    action: "contract-call",
  });
  if (verdict3) {
    registerAssessment(
      agentAddr,
      riskyTarget,
      verdict3.score,
      verdict3.verdict,
      verdict3.reasons?.[0] ?? "Blacklisted target",
    );
  }

  console.log("\n=== Done ===");
  console.log(`Agent txs: https://stellar.expert/explorer/testnet/account/${agentAddr}`);
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
