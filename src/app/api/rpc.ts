// Stellar Soroban RPC helpers — reads from deployed contracts via HTTP.
// Read operations are free on Stellar (simulation only, no tx needed).

import { CONTRACTS, DEPLOYER } from "@/lib/contracts-stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

export interface Assessment {
  id: number;
  agent: string;
  target: string;
  riskScore: number;
  verdict: string;
  reason: string;
  timestamp: number;
}

// --- Soroban contract read via simulateTransaction ---

function getRpcServer() {
  return new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
}

function scValToNative(val: StellarSdk.xdr.ScVal): unknown {
  return StellarSdk.scValToNative(val);
}

async function contractCall(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[] = []
): Promise<StellarSdk.xdr.ScVal> {
  const server = getRpcServer();
  const contract = new StellarSdk.Contract(contractId);

  // Build a transaction to simulate (not submit)
  const sourceAccount = await server.getAccount(DEPLOYER).catch(() => {
    // If deployer account fetch fails, use a dummy account for simulation
    return new StellarSdk.Account(DEPLOYER, "0");
  });

  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResponse = await server.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simResponse)) {
    throw new Error(`Simulation error: ${JSON.stringify(simResponse)}`);
  }

  if (!StellarSdk.rpc.Api.isSimulationSuccess(simResponse)) {
    throw new Error("Simulation failed");
  }

  const result = simResponse.result;
  if (!result) throw new Error("No result from simulation");

  return result.retval;
}

// --- AgentRegistry reads ---

export async function getAgentCount(): Promise<number> {
  try {
    const retval = await contractCall(CONTRACTS.agentRegistry, "get_agent_count");
    return scValToNative(retval) as number;
  } catch (err) {
    console.error("getAgentCount error:", err);
    return 0;
  }
}

// --- PolicyManager reads ---

export async function getThresholds(): Promise<{ low: number; medium: number }> {
  try {
    const retval = await contractCall(CONTRACTS.policyManager, "get_thresholds");
    const result = scValToNative(retval) as [number, number];
    return { low: result[0], medium: result[1] };
  } catch (err) {
    console.error("getThresholds error:", err);
    return { low: 30, medium: 70 };
  }
}

export async function getVerdict(riskScore: number): Promise<string> {
  try {
    const args = [StellarSdk.nativeToScVal(riskScore, { type: "u32" })];
    const retval = await contractCall(CONTRACTS.policyManager, "evaluate_score", args);
    return scValToNative(retval) as string;
  } catch (err) {
    console.error("getVerdict error:", err);
    // Fallback to local calculation
    const { low, medium } = await getThresholds();
    if (riskScore >= medium) return "BLOCK";
    if (riskScore >= low) return "WARN";
    return "ALLOW";
  }
}

// --- AssessmentRegistry reads ---

export async function getTotalAssessments(): Promise<number> {
  try {
    const retval = await contractCall(CONTRACTS.assessmentRegistry, "get_total_assessments");
    return scValToNative(retval) as number;
  } catch (err) {
    console.error("getTotalAssessments error:", err);
    return 0;
  }
}

export async function getAssessment(id: number): Promise<Assessment | null> {
  try {
    const args = [StellarSdk.nativeToScVal(id, { type: "u32" })];
    const retval = await contractCall(CONTRACTS.assessmentRegistry, "get_assessment", args);
    const data = scValToNative(retval) as Record<string, unknown>;
    return {
      id: data.id as number,
      agent: data.agent as string,
      target: data.target as string,
      riskScore: data.risk_score as number,
      verdict: data.verdict as string,
      reason: data.reason as string,
      timestamp: Number(data.timestamp),
    };
  } catch (err) {
    console.error(`getAssessment(${id}) error:`, err);
    return null;
  }
}

export async function getRecentAssessments(max = 10): Promise<Assessment[]> {
  const total = await getTotalAssessments();
  if (total === 0) return [];

  const count = Math.min(total, max);
  const promises = [];
  for (let i = total - 1; i >= total - count; i--) {
    promises.push(getAssessment(i));
  }
  const results = await Promise.all(promises);
  return results.filter((a): a is Assessment => a !== null);
}
