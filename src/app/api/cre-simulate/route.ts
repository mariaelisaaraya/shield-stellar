import { NextResponse } from "next/server";

const RISKY_ADDRESSES = [
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADST",
];

const ACTION_RISK: Record<string, number> = {
  transfer: 0, swap: 10, "contract-call": 15, mint: 10, other: 5,
};

const PENDING_TRANSACTIONS = [
  { agent: "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5356Y4A7UABCDEF", target: "GBDEVU2BKJNBHSGFEDCVQ7TOIYAN33OAGSQSUDKJ6LOZ7AGKP77WXYZ", amountXlm: 500, action: "transfer" },
  { agent: "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5356Y4A7UABCDEF", target: "GDKIJJKBXQ6KFBWPNA2FOBXGDOLBNC4GP2BKJCIMD7V3YO4M6LMNOPQR", amountXlm: 50000, action: "swap" },
  { agent: "GAWDG34BWB536FYQ4OZLCGKM3OHJHEPKPBWXG7OQMQKZ7RSTUV12345", target: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", amountXlm: 2000, action: "transfer" },
  { agent: "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5356Y4A7UABCDEF", target: "GDEAOEQP4KCASH3BXHFBGALEYOB7LRRQHBYS4A7EFGHIJ67890KLMNOP", amountXlm: 20000, action: "contract-call" },
];

const POLICY = { low: 30, medium: 70 };
const RISK_THRESHOLDS = { lowUsdValue: 100, highUsdValue: 1000 };
const XLM_PRICE_USD = 0.12;

function computeRiskScore(target: string, amountXlm: number, xlmPriceUsd: number, action: string) {
  let score = 10;
  const reasons: string[] = [];
  if (RISKY_ADDRESSES.includes(target)) { score += 60; reasons.push("CRITICAL: Known risky/burn address"); }
  const usdValue = amountXlm * xlmPriceUsd;
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
    const xlmPriceUsd = XLM_PRICE_USD;
    const assessments = PENDING_TRANSACTIONS.map((tx) => {
      const { score, reasons } = computeRiskScore(tx.target, tx.amountXlm, xlmPriceUsd, tx.action);
      const verdict = getVerdict(score);
      return { ...tx, usdValue: tx.amountXlm * xlmPriceUsd, riskScore: score, verdict, reasons };
    });
    const allowed = assessments.filter((a) => a.verdict === "ALLOW").length;
    const warned = assessments.filter((a) => a.verdict === "WARN").length;
    const blocked = assessments.filter((a) => a.verdict === "BLOCK").length;
    return NextResponse.json({
      workflow: "aegispay-risk-assessment", version: "2.0.0-stellar",
      network: "stellar:testnet",
      xlmPriceUsd, policyThresholds: POLICY,
      summary: { totalAssessed: assessments.length, allowed, warned, blocked, totalUsdExposure: assessments.reduce((s, a) => s + a.usdValue, 0), blockedUsdValue: assessments.filter((a) => a.verdict === "BLOCK").reduce((s, a) => s + a.usdValue, 0) },
      assessments, timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
