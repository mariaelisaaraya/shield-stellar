import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
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

if (!STELLAR_PRIVATE_KEY) {
  console.error("ERROR: STELLAR_PRIVATE_KEY not set in .env");
  process.exit(1);
}

async function payAndFetch(httpClient, client, endpoint) {
  const url = `${SERVER_URL}${endpoint}`;
  console.log(`\n→ GET ${url}`);

  // Step 1: Try without payment — get 402
  const firstTry = await fetch(url);
  console.log(`  Status: ${firstTry.status}`);

  if (firstTry.status !== 402) {
    const body = await firstTry.text();
    console.log(`  Response: ${body}`);
    return;
  }

  console.log("  Payment required — signing USDC transaction...");

  // Step 2: Get payment requirements from 402 response
  const paymentRequired = httpClient.getPaymentRequiredResponse(
    (name) => firstTry.headers.get(name),
  );

  // Step 3: Create signed payment payload
  let paymentPayload = await client.createPaymentPayload(paymentRequired);

  // Step 4: Set fee to 1 stroop (testnet facilitator requirement)
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

  // Step 5: Encode payment header and retry
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
    console.log(`  Settlement: ${JSON.stringify(paymentResponse)}`);
  }
}

async function main() {
  console.log("=== ShieldStellar x402 Agent ===\n");

  // Setup x402 client
  const signer = createEd25519Signer(STELLAR_PRIVATE_KEY, NETWORK);
  const rpcConfig = { url: STELLAR_RPC_URL };
  const client = new x402Client().register(
    "stellar:*",
    new ExactStellarScheme(signer, rpcConfig),
  );
  const httpClient = new x402HTTPClient(client);

  console.log(`Agent: ${signer.address}`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Network: ${NETWORK}`);

  // Test 1: Get thresholds (pays $0.0005 USDC)
  await payAndFetch(httpClient, client, "/thresholds");

  // Test 2: Get verdict for score 50 (pays $0.001 USDC)
  await payAndFetch(httpClient, client, "/verdict?score=50");

  // Test 3: Get verdict for score 85 (pays $0.001 USDC)
  await payAndFetch(httpClient, client, "/verdict?score=85");

  console.log("\n=== Done — check Stellar Expert for payment transactions ===");
  console.log(`https://stellar.expert/explorer/testnet/account/${signer.address}`);
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
