// Stellar Soroban RPC helpers — reads from deployed contracts on testnet.
// Read operations are free on Stellar (simulation only, no tx needed).

import { CONTRACTS } from "@/lib/contracts-stellar";

const SOROBAN_RPC = "https://soroban-testnet.stellar.org";

export interface Assessment {
  id: number;
  agent: string;
  target: string;
  riskScore: number;
  verdict: string;
  reason: string;
  timestamp: number;
}

// --- Soroban RPC call helper ---

async function sorobanSimulate(contractId: string, method: string, args: unknown[] = []) {
  const res = await fetch(SOROBAN_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: { /* placeholder — we use CLI for now */ },
    }),
  });
  return res.json();
}

// For server-side reads we shell out to stellar CLI which handles
// XDR encoding/decoding. This is simpler and more reliable than
// manually building Soroban XDR for read calls.

async function contractRead(contractId: string, fn: string, args: string[] = []): Promise<string> {
  const { execSync } = await import("child_process");
  const argsStr = args.join(" ");
  const cmd = `stellar contract invoke --id ${contractId} --network testnet --source deployer -- ${fn} ${argsStr} 2>&1`;
  try {
    const output = execSync(cmd, { encoding: "utf-8", timeout: 15000 }).trim();
    // Filter out CLI info messages (e.g. "ℹ️  Simulation identified as read-only...")
    const lines = output.split("\n");
    const dataLine = lines.filter((l) => !l.startsWith("ℹ️") && !l.startsWith("⚠️")).join("\n").trim();
    return dataLine || output;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "contract read failed";
    console.error(`contractRead error (${fn}):`, message);
    throw new Error(message);
  }
}

// --- AgentRegistry reads ---

export async function getAgentCount(): Promise<number> {
  try {
    const result = await contractRead(CONTRACTS.agentRegistry, "get_agent_count");
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

// --- PolicyManager reads ---

export async function getThresholds(): Promise<{ low: number; medium: number }> {
  try {
    const result = await contractRead(CONTRACTS.policyManager, "get_thresholds");
    // Result format: [30,70]
    const parsed = JSON.parse(result);
    return { low: parsed[0], medium: parsed[1] };
  } catch {
    return { low: 30, medium: 70 };
  }
}

export async function getVerdict(riskScore: number): Promise<string> {
  try {
    const result = await contractRead(
      CONTRACTS.policyManager,
      "evaluate_score",
      [`--score ${riskScore}`]
    );
    // Result format: "ALLOW" (with quotes)
    return result.replace(/"/g, "");
  } catch {
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
    const result = await contractRead(CONTRACTS.assessmentRegistry, "get_total_assessments");
    return parseInt(result, 10) || 0;
  } catch {
    return 0;
  }
}

export async function getAssessment(id: number): Promise<Assessment | null> {
  try {
    const result = await contractRead(
      CONTRACTS.assessmentRegistry,
      "get_assessment",
      [`--id ${id}`]
    );
    const data = JSON.parse(result);
    return {
      id: data.id,
      agent: data.agent,
      target: data.target,
      riskScore: data.risk_score,
      verdict: data.verdict,
      reason: data.reason,
      timestamp: data.timestamp,
    };
  } catch {
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
