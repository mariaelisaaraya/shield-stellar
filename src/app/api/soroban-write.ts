// Soroban contract write helper — builds, simulates, signs, and submits transactions.
// Used to register assessments on-chain from the server.

import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

// Deployer secret key — used to sign server-side transactions
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET || "";

function getRpcServer() {
  return new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
}

export async function submitContractCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<{ txHash: string; success: boolean }> {
  if (!DEPLOYER_SECRET) {
    throw new Error("DEPLOYER_SECRET not configured");
  }

  const server = getRpcServer();
  const keypair = StellarSdk.Keypair.fromSecret(DEPLOYER_SECRET);
  const publicKey = keypair.publicKey();

  const sourceAccount = await server.getAccount(publicKey);
  const contract = new StellarSdk.Contract(contractId);

  // Build transaction
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate
  const simResponse = await server.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation error: ${JSON.stringify(simResponse)}`);
  }

  // Assemble with simulation results
  const assembledTx = StellarSdk.rpc.assembleTransaction(tx, simResponse).build();

  // Sign
  assembledTx.sign(keypair);

  // Submit
  const sendResponse = await server.sendTransaction(assembledTx);

  if (sendResponse.status === "ERROR") {
    throw new Error(`Submit error: ${JSON.stringify(sendResponse)}`);
  }

  // Wait for confirmation
  const txHash = sendResponse.hash;
  let getResponse = await server.getTransaction(txHash);

  while (getResponse.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    getResponse = await server.getTransaction(txHash);
  }

  return {
    txHash,
    success: getResponse.status === "SUCCESS",
  };
}
