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
  amountHbar: number;
  usdValue: number;
  riskScore: number;
  verdict: Verdict;
  reasons: string[];
  action: string;
}

interface WorkflowResult {
  workflow: string;
  version: string;
  executedOn: string;
  hbarPriceUsd: number;
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
    <div className="rounded-xl p-4" style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}>
      <p className="font-mono text-[10px] tracking-[0.1em] mb-1" style={{ color: "#444" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#555" }}>{sub}</p>}
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === "ALLOW") return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
  if (verdict === "WARN") return <ShieldAlert className="w-4 h-4 text-amber-400" />;
  return <ShieldOff className="w-4 h-4 text-red-400" />;
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#141414", border: "1px solid #1a1a1a" }}>
            <Link2 className="w-4 h-4" style={{ color: "#2563EB" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
              CRE Workflow
            </h1>
            <p className="text-sm" style={{ color: "#555" }}>Decentralized risk assessment on Chainlink DON</p>
          </div>
        </div>

        {/* Chainlink badge */}
        <div className="mb-6 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "#0a1628", border: "1px solid #1a2a4a" }}>
          <Server className="w-3.5 h-3.5" style={{ color: "#375BD2" }} />
          <span className="text-xs font-mono" style={{ color: "#6B8AFF" }}>
            Powered by Chainlink Runtime Environment (CRE)
          </span>
          <a
            href="https://docs.chain.link/cre"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <ExternalLink className="w-3 h-3" style={{ color: "#375BD2" }} />
          </a>
        </div>

        {/* How it works */}
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}>
          <p className="font-mono text-[10px] tracking-[0.1em] mb-3" style={{ color: "#444" }}>HOW IT WORKS</p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono" style={{ color: "#888" }}>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#141414", color: "#6B8AFF" }}>Cron Trigger</span>
            <span style={{ color: "#333" }}>-&gt;</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#141414", color: "#f59e0b" }}>HTTP: HBAR Price</span>
            <span style={{ color: "#333" }}>-&gt;</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#141414", color: "#22c55e" }}>Risk Scoring</span>
            <span style={{ color: "#333" }}>-&gt;</span>
            <span className="rounded px-2 py-1" style={{ backgroundColor: "#141414", color: "#ef4444" }}>Verdict</span>
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: "#555" }}>
            The workflow runs on a Chainlink Decentralized Oracle Network (DON).
            Multiple nodes fetch the HBAR/USD price, reach consensus, then score each
            pending AI agent transaction using AegisPay&apos;s risk engine.
          </p>
        </div>

        {/* Run button */}
        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 mb-6"
          style={{ backgroundColor: "#375BD2" }}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running CRE Workflow on DON...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run CRE Risk Assessment
            </>
          )}
        </button>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
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
              {/* Live price + execution info */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: "#0a1628", border: "1px solid #1a2a4a" }}>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" style={{ color: "#6B8AFF" }} />
                  <span className="text-sm font-mono" style={{ color: "#6B8AFF" }}>
                    HBAR/USD: ${result.hbarPriceUsd.toFixed(4)}
                  </span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="ASSESSED" value={result.summary.totalAssessed} color="#f0f0f0" />
                <StatCard label="ALLOWED" value={result.summary.allowed} color="#22c55e" />
                <StatCard label="WARNED" value={result.summary.warned} color="#f59e0b" />
                <StatCard label="BLOCKED" value={result.summary.blocked} color="#ef4444" />
              </div>

              {/* Exposure */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="TOTAL EXPOSURE"
                  value={`$${result.summary.totalUsdExposure.toFixed(2)}`}
                  color="#f0f0f0"
                />
                <StatCard
                  label="VALUE BLOCKED"
                  value={`$${result.summary.blockedUsdValue.toFixed(2)}`}
                  sub="protected by AegisPay"
                  color="#ef4444"
                />
              </div>

              {/* Assessment table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1a1a1a" }}>
                <div className="px-4 py-3" style={{ backgroundColor: "#0f0f0f", borderBottom: "1px solid #1a1a1a" }}>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#444" }}>
                    TRANSACTION ASSESSMENTS
                  </p>
                </div>
                <div className="divide-y divide-[#1a1a1a]">
                  {result.assessments.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="px-4 py-3"
                      style={{ backgroundColor: "#0a0a0a" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <VerdictIcon verdict={a.verdict} />
                          <span className="text-sm font-medium" style={{ color: "#f0f0f0" }}>
                            TX #{i + 1}: {a.action}
                          </span>
                        </div>
                        <VerdictBadge verdict={a.verdict} />
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono mb-2">
                        <div>
                          <span style={{ color: "#444" }}>Amount: </span>
                          <span style={{ color: "#888" }}>{a.amountHbar} HBAR (${a.usdValue.toFixed(2)})</span>
                        </div>
                        <div>
                          <span style={{ color: "#444" }}>Score: </span>
                          <span style={{
                            color: a.verdict === "ALLOW" ? "#22c55e" : a.verdict === "WARN" ? "#f59e0b" : "#ef4444"
                          }}>
                            {a.riskScore}/100
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span style={{ color: "#444" }}>Target: </span>
                          <span style={{ color: "#555" }}>{a.target.slice(0, 10)}...{a.target.slice(-6)}</span>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="space-y-0.5">
                        {a.reasons.map((r, ri) => (
                          <div key={ri} className="flex items-start gap-1.5">
                            <span
                              className="mt-1.5 block h-1 w-1 rounded-full shrink-0"
                              style={{
                                backgroundColor: a.verdict === "ALLOW" ? "#22c55e" : a.verdict === "WARN" ? "#f59e0b" : "#ef4444",
                              }}
                            />
                            <span className="text-[11px]" style={{ color: "#666" }}>{r}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Policy info */}
              <div className="flex items-center justify-between rounded-lg px-4 py-2 text-xs font-mono" style={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", color: "#555" }}>
                <span>Policy Thresholds</span>
                <span>
                  <span className="text-emerald-400">ALLOW &lt;{result.policyThresholds.low}</span>{" | "}
                  <span className="text-amber-400">WARN {result.policyThresholds.low}-{result.policyThresholds.medium}</span>{" | "}
                  <span className="text-red-400">BLOCK &gt;={result.policyThresholds.medium}</span>
                </span>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 text-xs">
                <a
                  href="https://github.com/mariaelisaaraya/flujoAgente/tree/main/workflow/aegispay"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono hover:underline"
                  style={{ color: "#555" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  View Workflow Source
                </a>
                <a
                  href="https://docs.chain.link/cre"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-mono hover:underline"
                  style={{ color: "#555" }}
                >
                  <ExternalLink className="w-3 h-3" />
                  CRE Documentation
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
