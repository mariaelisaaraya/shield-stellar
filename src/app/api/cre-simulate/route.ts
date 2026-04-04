import { NextResponse } from "next/server";

const RISKY_ADDRESSES = [
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
];

const ACTION_RISK: Record<string, number> = {
  transfer: 0, swap: 10, "contract-call": 15, mint: 10, other: 5,
};

const PENDING_TRANSACTIONS = [
  { agent: "0x1234567890abcdef1234567890abcdef12345678", target: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", amountHbar: 50, action: "transfer" },
  { agent: "0x1234567890abcdef1234567890abcdef12345678", target: "0x9876543210fedcba9876543210fedcba98765432", amountHbar: 5000, action: "swap" },
  { agent: "0xaaaabbbbccccddddaaaabbbbccccddddaaaabbbb", target: "0x000000000000000000000000000000000000dead", amountHbar: 200, action: "transfer" },
  { agent: "0x1234567890abcdef1234567890abcdef12345678", target: "0x5555666677778888555566667777888855556666", amountHbar: 2000, action: "contract-call" },
];

const POLICY = { low: 30, medium: 70 };
const RISK_THRESHOLDS = { lowUsdValue: 100, highUsdValue: 1000 };

function computeRiskScore(target: string, amountHbar: number, hbarPriceUsd: number, action: string) {
  let score = 10;
  const reasons: string[] = [];
  if (RISKY_ADDRESSES.includes(target.toLowerCase())) { score += 60; reasons.push("CRITICAL: Known risky/burn address"); }
  const usdValue = amountHbar * hbarPriceUsd;
  if (usdValue > RISK_THRESHOLDS.highUsdValue) { score += 35; reasons.push(`HIGH VALUE: $${usdValue.toFixed(2)} USD (>${RISK_THRESHOLDS.highUsdValue})`); }
  else if (usdValue > RISK_THRESHOLDS.lowUsdValue) { score += 15; reasons.push(`MEDIUM VALUE: $${usdValue.toFixed(2)} USD (>${RISK_THRESHOLDS.lowUsdValue})`); }
  else { reasons.push(`Low value: $${usdValue.toFixed(2)} USD`); }
  const actionRisk = ACTION_RISK[action] ?? 5;
  if (actionRisk > 0) { score += actionRisk; reasons.push(`Action: ${action} (+${actionRisk} risk)`); }
  score += 15; reasons.push("New target: first interaction");
  return { score: Math.min(100, Math.max(0, score)), reasons };
}

function getVerdict(score: number): "ALLOW" | "WARN" | "BLOCK" {
  if (score < POLICY.low) return "ALLOW";
  if (score < POLICY.medium) return "WARN";
  return "BLOCK";
}

export async function POST() {
  try {
    let hbarPriceUsd = 0.05;
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd", { next: { revalidate: 60 } });
      const data = await res.json();
      hbarPriceUsd = data["hedera-hashgraph"]?.usd ?? 0.05;
    } catch {}
    const assessments = PENDING_TRANSACTIONS.map((tx) => {
      const { score, reasons } = computeRiskScore(tx.target, tx.amountHbar, hbarPriceUsd, tx.action);
      const verdict = getVerdict(score);
      return { ...tx, usdValue: tx.amountHbar * hbarPriceUsd, riskScore: score, verdict, reasons };
    });
    const allowed = assessments.filter((a) => a.verdict === "ALLOW").length;
    const warned = assessments.filter((a) => a.verdict === "WARN").length;
    const blocked = assessments.filter((a) => a.verdict === "BLOCK").length;
    return NextResponse.json({
      workflow: "aegispay-risk-assessment", version: "1.0.0", executedOn: "Chainlink DON (simulated)",
      hbarPriceUsd, policyThresholds: POLICY,
      summary: { totalAssessed: assessments.length, allowed, warned, blocked, totalUsdExposure: assessments.reduce((s, a) => s + a.usdValue, 0), blockedUsdValue: assessments.filter((a) => a.verdict === "BLOCK").reduce((s, a) => s + a.usdValue, 0) },
      assessments, timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
