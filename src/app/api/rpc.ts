// Stellar RPC helpers — will connect to Soroban contracts once deployed.
// For now, uses in-memory state so the API routes work end-to-end.

export interface Assessment {
  id: number;
  agent: string;
  target: string;
  riskScore: number;
  verdict: string;
  reason: string;
  timestamp: number;
}

// --- In-memory state (replaced by Soroban contract calls after deploy) ---

let agents: string[] = [];
let assessments: Assessment[] = [];
let policy = { low: 30, medium: 70 };

export async function getAgentCount(): Promise<number> {
  return agents.length;
}

export async function registerAgent(address: string): Promise<void> {
  if (!agents.includes(address)) agents.push(address);
}

export async function getTotalAssessments(): Promise<number> {
  return assessments.length;
}

export async function getThresholds(): Promise<{ low: number; medium: number }> {
  return policy;
}

export async function setThresholds(low: number, medium: number): Promise<void> {
  policy = { low, medium };
}

export async function getVerdict(riskScore: number): Promise<string> {
  if (riskScore >= policy.medium) return "BLOCK";
  if (riskScore >= policy.low) return "WARN";
  return "ALLOW";
}

export async function createAssessment(
  agent: string,
  target: string,
  riskScore: number,
  verdict: string,
  reason: string,
): Promise<Assessment> {
  const assessment: Assessment = {
    id: assessments.length,
    agent,
    target,
    riskScore,
    verdict,
    reason,
    timestamp: Math.floor(Date.now() / 1000),
  };
  assessments.push(assessment);
  return assessment;
}

export async function getAssessment(id: number): Promise<Assessment | null> {
  return assessments[id] ?? null;
}

export async function getRecentAssessments(max = 10): Promise<Assessment[]> {
  return assessments.slice(-max).reverse();
}
