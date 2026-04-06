"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageWrapper } from "@/components/demos/PageWrapper";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import {
  Link2,
  Play,
  Loader2,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ExternalLink,
  Server,
} from "lucide-react";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

interface Assessment {
  agent: string;
  target: string;
  amountXlm: number;
  usdValue: number;
  riskScore: number;
  verdict: Verdict;
  reasons: string[];
  action: string;
}

interface WorkflowResult {
  workflow: string;
  version: string;
  network: string;
  xlmPriceUsd: number;
  policyThresholds: { low: number; medium: number };
  summary: {
    totalAssessed: number;
    allowed: number;
    warned: number;
    blocked: number;
    totalUsdExposure: number;
    blockedUsdValue: number;
  };
  assessments: Assessment[];
  timestamp: string;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}>
      <p className="font-mono text-[10px] tracking-[0.1em] mb-1" style={{ color: "#a1a1aa" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#52525b" }}>{sub}</p>}
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "ALLOW") return <ShieldCheck className="w-4 h-4" style={{ color: "#166534" }} />;
  if (verdict === "WARN") return <ShieldAlert className="w-4 h-4" style={{ color: "#854d0e" }} />;
  return <ShieldOff className="w-4 h-4" style={{ color: "#dc2626" }} />;
}

export default function WorkflowPage() {
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cre-simulate", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Simulation failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe" }}>
            <Link2 className="w-4 h-4" style={{ color: "#5b5cf6" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: "#0f0f10" }}>
              CRE Workflow
            </h1>
            <p className="text-sm" style={{ color: "#52525b" }}>Batch risk assessment on Stellar Testnet</p>
          </div>
        </div>

        {/* Network badge */}
        <div className="mt-6 mb-6 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe" }}>
          <Server className="w-3.5 h-3.5" style={{ color: "#5b5cf6" }} />
          <span className="text-xs font-mono" style={{ color: "#5b5cf6" }}>
            Stellar Testnet — x402 Risk Assessment Engine
          </span>
        </div>

        {/* How it works */}
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}>
          <p className="font-mono text-[10px] tracking-[0.1em] mb-3" style={{ color: "#a1a1aa" }}>HOW IT WORKS</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono" style={{ color: "#52525b" }}>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#efefff", color: "#5b5cf6" }}>Agent Request</span>
            <span style={{ color: "#d4d4d8" }}>→</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#fffbeb", color: "#854d0e" }}>x402 Payment</span>
            <span style={{ color: "#d4d4d8" }}>→</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#f0fdf4", color: "#166534" }}>Risk Scoring</span>
            <span style={{ color: "#d4d4d8" }}>→</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>Verdict</span>
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: "#52525b" }}>
            The workflow evaluates pending AI agent transactions using AegisPay&apos;s risk engine
            on Stellar. Agents pay for assessments via x402 micropayments in USDC.
          </p>
        </div>

        {/* Run button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 mb-6"
          style={{ backgroundColor: "#5b5cf6" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Risk Assessment...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Batch Risk Assessment
            </>
          )}
        </button>

        {error && (
          <div className="mb-4 rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* Live price */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe" }}>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: "#5b5cf6" }} />
                  <span className="text-sm font-mono" style={{ color: "#5b5cf6" }}>
                    XLM/USD: ${result.xlmPriceUsd.toFixed(4)}
                  </span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: "#a1a1aa" }}>
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="ASSESSED" value={result.summary.totalAssessed} color="#0f0f10" />
                <StatCard label="ALLOWED" value={result.summary.allowed} color="#166534" />
                <StatCard label="WARNED" value={result.summary.warned} color="#854d0e" />
                <StatCard label="BLOCKED" value={result.summary.blocked} color="#dc2626" />
              </div>

              {/* Exposure */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="TOTAL EXPOSURE"
                  value={`$${result.summary.totalUsdExposure.toFixed(2)}`}
                  color="#0f0f10"
                />
                <StatCard
                  label="VALUE BLOCKED"
                  value={`$${result.summary.blockedUsdValue.toFixed(2)}`}
                  sub="protected by AegisPay"
                  color="#dc2626"
                />
              </div>

              {/* Assessment table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #ebebed" }}>
                <div className="px-4 py-3" style={{ backgroundColor: "#f7f7f8", borderBottom: "1px solid #ebebed" }}>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#a1a1aa" }}>
                    TRANSACTION ASSESSMENTS
                  </p>
                </div>
                <div>
                  {result.assessments.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="px-4 py-3"
                      style={{ backgroundColor: "#ffffff", borderTop: i > 0 ? "1px solid #ebebed" : undefined }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <VerdictIcon verdict={a.verdict} />
                          <span className="text-sm font-medium" style={{ color: "#0f0f10" }}>
                            TX #{i + 1}: {a.action}
                          </span>
                        </div>
                        <VerdictBadge verdict={a.verdict} />
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono mb-2">
                        <div>
                          <span style={{ color: "#a1a1aa" }}>Amount: </span>
                          <span style={{ color: "#52525b" }}>{a.amountXlm} XLM (${a.usdValue.toFixed(2)})</span>
                        </div>
                        <div>
                          <span style={{ color: "#a1a1aa" }}>Score: </span>
                          <span style={{
                            color: a.verdict === "ALLOW" ? "#166534" : a.verdict === "WARN" ? "#854d0e" : "#dc2626"
                          }}>
                            {a.riskScore}/100
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span style={{ color: "#a1a1aa" }}>Target: </span>
                          <span style={{ color: "#52525b" }}>{a.target.slice(0, 10)}...{a.target.slice(-6)}</span>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="space-y-0.5">
                        {a.reasons.map((r, ri) => (
                          <div key={ri} className="flex items-start gap-1.5">
                            <span
                              className="mt-1.5 block h-1 w-1 rounded-full shrink-0"
                              style={{
                                backgroundColor: a.verdict === "ALLOW" ? "#166534" : a.verdict === "WARN" ? "#854d0e" : "#dc2626",
                              }}
                            />
                            <span className="text-[11px]" style={{ color: "#52525b" }}>{r}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Policy info */}
              <div className="flex items-center justify-between rounded-lg px-4 py-2 text-xs font-mono" style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe", color: "#52525b" }}>
                <span>Policy Thresholds</span>
                <span>
                  <span style={{ color: "#166534" }}>ALLOW &lt;{result.policyThresholds.low}</span>{" | "}
                  <span style={{ color: "#854d0e" }}>WARN {result.policyThresholds.low}-{result.policyThresholds.medium}</span>{" | "}
                  <span style={{ color: "#dc2626" }}>BLOCK &gt;={result.policyThresholds.medium}</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
