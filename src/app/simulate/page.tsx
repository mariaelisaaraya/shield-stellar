"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { ArrowRight, ShieldAlert, ShieldOff, Check, X, Loader2, CheckCircle2, Activity } from "lucide-react";
import { useStellarWallet } from "@/components/providers";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

interface SimResult {
  score: number;
  verdict: Verdict;
  reasons: string[];
}

const ACTION_RISK: Record<string, number> = {
  transfer: 0, swap: 10, "contract-call": 15, mint: 10, other: 5,
};

function computeRiskScore(target: string, amount: number, action: string): number {
  let score = 0;
  const addr = target.toUpperCase();
  if (addr.includes("AAAA") || addr.includes("DEAD")) score += 60;
  if (amount > 100) score += 35;
  else if (amount > 10) score += 20;
  else if (amount > 1) score += 10;
  else score += 5;
  score += ACTION_RISK[action] || 5;
  score += 10;
  return Math.max(0, Math.min(score, 100));
}

function getReasonsForScore(score: number, verdict: Verdict, action: string, amount: number): string[] {
  const reasons: string[] = [];
  if (amount > 100) reasons.push("High value transaction");
  else if (amount > 10) reasons.push("Moderate transaction amount");
  else reasons.push("Low value transaction");
  if (action === "contract-call") reasons.push("Contract interaction requires extra scrutiny");
  else if (action === "swap") reasons.push("Swap operation detected");
  else if (action === "mint") reasons.push("Mint operation detected");
  if (verdict === "BLOCK") reasons.push("Risk score exceeds block threshold");
  else if (verdict === "WARN") reasons.push("Score in warning zone — human review recommended");
  else reasons.push("All checks passed — safe to execute");
  return reasons;
}

interface TraceStep {
  label: string;
  result: string;
  status: "ok" | "warn" | "neutral";
}

const stepNumbers = ["①", "②", "③", "④", "⑤"];

function buildTraceSteps(target: string, amount: string, action: string): TraceStep[] {
  const amt = parseFloat(amount) || 0;
  const knownAddress = target.startsWith("G") && target.length === 56;
  const actionLabel = actionTypes.find((a) => a.value === action)?.label || action;

  return [
    { label: "Resolving target address...", result: knownAddress ? "Valid Stellar address" : "Unknown address", status: knownAddress ? "ok" : "warn" },
    { label: `Evaluating amount (${amount || "0"} XLM)...`, result: amt > 1000 ? "High value" : amt >= 10 ? "Elevated" : "Low value", status: amt > 1000 ? "warn" : amt >= 10 ? "warn" : "ok" },
    { label: `Analyzing action type (${actionLabel})...`, result: action === "contract-call" ? "High risk" : action === "swap" || action === "mint" ? "Requires review" : "Safe action", status: action === "contract-call" ? "warn" : action === "swap" || action === "mint" ? "warn" : "ok" },
    { label: "Applying policy thresholds...", result: "Thresholds loaded", status: "ok" },
    { label: "Computing verdict...", result: "Assessment complete", status: "neutral" },
  ];
}

const actionTypes = [
  { value: "transfer", label: "Transfer" },
  { value: "contract-call", label: "Contract Call" },
  { value: "swap", label: "Swap" },
  { value: "mint", label: "Mint" },
  { value: "other", label: "Other" },
];

const inputClass =
  "flex h-9 w-full rounded-lg border px-3 py-1 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none";

export default function SimulatePage() {
  const [form, setForm] = useState({ agent: "", target: "", amount: "", action: "transfer" });
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [thresholds, setThresholds] = useState<[number, number] | null>(null);
  const [operatorDecision, setOperatorDecision] = useState<"approved" | "rejected" | null>(null);
  const { publicKey, isConnected } = useStellarWallet();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [traceProgress, setTraceProgress] = useState(-1);
  const [traceVisible, setTraceVisible] = useState(false);
  const pendingResult = useRef<SimResult | null>(null);

  useEffect(() => {
    fetch("/api/thresholds")
      .then((r) => r.json())
      .then((data) => { if (data.low !== undefined) setThresholds([data.low, data.medium]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (traceProgress < 0 || traceProgress >= traceSteps.length) return;
    const timer = setTimeout(() => {
      const next = traceProgress + 1;
      setTraceProgress(next);
      if (next >= traceSteps.length) {
        setTimeout(() => {
          const assessment = pendingResult.current;
          if (assessment) {
            setResult(assessment);
            setLoading(false);
            if (assessment.verdict === "WARN") setShowModal(true);
          }
        }, 400);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [traceProgress, traceSteps.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setOperatorDecision(null);
    setIsRegistered(false);

    const steps = buildTraceSteps(form.target, form.amount, form.action);
    setTraceSteps(steps);
    setTraceVisible(true);
    setTraceProgress(0);

    try {
      const amt = parseFloat(form.amount) || 0;
      const riskScore = computeRiskScore(form.target, amt, form.action);
      const response = await fetch(`/api/verdict?score=${riskScore}`);
      const json = await response.json();
      if (json.error) throw new Error(json.error);
      const verdict = json.verdict as Verdict;
      const reasons = getReasonsForScore(riskScore, verdict, form.action, amt);
      pendingResult.current = { score: riskScore, verdict, reasons };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to query PolicyManager");
      setLoading(false);
    }
  }

  function handleApproval(decision: "approved" | "rejected") {
    setShowModal(false);
    setOperatorDecision(decision);
    if (decision === "approved" && result) handleRegister();
  }

  async function handleRegister() {
    if (!isConnected || !publicKey || !result) return;
    setIsRegistering(true);
    try {
      // TODO: Replace with Soroban contract call after deploy
      await new Promise((r) => setTimeout(r, 1000));
      setIsRegistered(true);
    } catch {
      setError("Failed to register assessment");
    } finally {
      setIsRegistering(false);
    }
  }

  const showRegisterButton =
    result &&
    ((result.verdict === "ALLOW") ||
      (result.verdict === "WARN" && operatorDecision === "approved"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="mb-8">
        <span className="block font-mono tracking-[0.12em] mb-2 text-xs" style={{ color: "#a1a1aa" }}>SIMULATE &middot; RISK ASSESSMENT</span>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#0f0f10" }}>Simulate Assessment</h1>
        <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>Test the risk engine before your agent executes a real transaction</p>
      </div>

      {thresholds && (
        <div className="mb-4 flex items-center justify-between px-4 py-2 text-xs font-mono" style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe", color: "#52525b", borderRadius: "10px" }}>
          <span>Active Policy</span>
          <span>
            <span style={{ color: "#166534" }}>ALLOW &lt;{thresholds[0]}</span>{" · "}
            <span style={{ color: "#854d0e" }}>WARN {thresholds[0]}-{thresholds[1]}</span>{" · "}
            <span style={{ color: "#dc2626" }}>BLOCK &gt;{thresholds[1]}</span>
          </span>
        </div>
      )}

      <div className="p-6" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>AGENT ADDRESS</label>
            <input placeholder="G... or agent name" value={form.agent} onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))} className={inputClass} style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")} onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")} />
          </div>
          <div className="space-y-2">
            <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>TARGET ADDRESS</label>
            <input placeholder="G..." value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} required className={inputClass} style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")} onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>AMOUNT</label>
              <div className="relative">
                <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required className={inputClass} style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10", paddingRight: "52px" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")} onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono" style={{ fontSize: "10px", color: "#a1a1aa" }}>XLM</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>ACTION TYPE</label>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} className={inputClass} style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10" }} onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")} onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}>
                {actionTypes.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 text-sm font-semibold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#5b5cf6", borderRadius: "10px" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}>
            {loading ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Assessing…</>) : (<>Run Assessment<ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      </div>

      {error && (<div className="mt-4 rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{error}</div>)}

      {/* Assessment Trace */}
      <AnimatePresence>
        {traceVisible && traceSteps.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="mt-4 rounded-lg" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed", padding: 16 }}>
            <span className="block font-mono uppercase tracking-[0.14em] mb-4" style={{ fontSize: "10px", color: "#a1a1aa" }}>Assessment Trace</span>
            <div className="relative" style={{ paddingLeft: 20 }}>
              <div className="absolute top-0 bottom-0" style={{ left: 5, width: 1, backgroundColor: "#5b5cf6", opacity: 0.2 }} />
              <div className="space-y-3">
                {traceSteps.map((step, i) => {
                  const isCompleted = i < traceProgress;
                  const isCurrent = i === traceProgress && traceProgress < traceSteps.length;
                  const isVisible = i <= traceProgress;
                  if (!isVisible) return null;
                  const resultColor = step.status === "ok" ? "#166534" : step.status === "warn" ? "#854d0e" : "#5b5cf6";
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="relative flex items-center justify-between gap-3">
                      <div className="absolute" style={{ left: -19, top: "50%", transform: "translateY(-50%)" }}>
                        {isCurrent ? <Loader2 className="animate-spin" style={{ width: 10, height: 10, color: "#5b5cf6" }} /> : <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: resultColor, marginLeft: 1.5 }} />}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono shrink-0" style={{ fontSize: "12px", color: "#a1a1aa" }}>{stepNumbers[i]}</span>
                        <span className="font-mono truncate" style={{ fontSize: "12px", color: isCompleted ? "#52525b" : "#a1a1aa" }}>{step.label}</span>
                      </div>
                      {isCompleted && (<motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="font-mono shrink-0" style={{ fontSize: "11px", color: resultColor }}>{step.result}</motion.span>)}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="mt-4 rounded-xl p-6" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: "#a1a1aa" }}>Result</span>
              <VerdictBadge verdict={result.verdict} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#a1a1aa" }}>Risk Score</span>
                <span className="text-2xl font-bold font-mono" style={{ color: "#0f0f10" }}>{result.score}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f7f7f8" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${result.score}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className={`h-full rounded-full ${result.verdict === "ALLOW" ? "bg-emerald-500" : result.verdict === "WARN" ? "bg-amber-500" : "bg-red-500"}`} />
              </div>
              <div className="pt-2 space-y-1.5">
                {result.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: result.verdict === "ALLOW" ? "#166534" : result.verdict === "WARN" ? "#854d0e" : "#dc2626" }} />
                    <span className="text-xs leading-relaxed" style={{ color: "#52525b" }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {operatorDecision && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium" style={operatorDecision === "approved" ? { backgroundColor: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" } : { backgroundColor: "#fef2f2", color: "#dc2626", borderColor: "#fecaca" }}>
                  {operatorDecision === "approved" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  {operatorDecision === "approved" ? "Approved — proceeding with transaction" : "Rejected — transaction cancelled"}
                </motion.div>
              )}
            </AnimatePresence>

            {result.verdict === "BLOCK" && (
              <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                <ShieldOff className="w-4 h-4 shrink-0" />Transfer blocked by AegisPay
              </div>
            )}

            <AnimatePresence>
              {showRegisterButton && !isRegistered && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.25 }} className="mt-4">
                  <button onClick={handleRegister} disabled={isRegistering} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50" style={{ backgroundColor: "#5b5cf6" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}>
                    {isRegistering ? "Confirming on Stellar..." : "Register Assessment on Stellar"}
                  </button>
                </motion.div>
              )}
              {isRegistered && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium" style={{ backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />Assessment registered on Stellar
                </motion.div>
              )}
              {isRegistered && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                  <button onClick={() => { setResult(null); setOperatorDecision(null); setIsRegistered(false); setForm({ agent: "", target: "", amount: "", action: "transfer" }); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: "#f7f7f8", color: "#52525b", border: "1px solid #ebebed" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#efefff")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f8")}>
                    <Activity className="w-4 h-4" />New Assessment
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Human Approval Modal */}
      <AnimatePresence>
        {showModal && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/20" onClick={() => handleApproval("rejected")} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex w-12 h-12 items-center justify-center rounded-2xl" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <ShieldAlert style={{ color: "#166534" }} className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#0f0f10" }}>Human Approval Required</h2>
                  <p className="text-sm font-mono" style={{ color: "#a1a1aa" }}>Freighter Wallet</p>
                </div>
              </div>
              <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: "#f7f7f8", border: "1px solid #ebebed" }}>
                <p className="text-sm mb-4" style={{ color: "#52525b" }}>This action has <span style={{ color: "#854d0e" }} className="font-semibold">medium</span> risk. Human approval required before moving funds.</p>
              </div>
              <div className="rounded-2xl p-4 mb-6 space-y-2" style={{ backgroundColor: "#f7f7f8", border: "1px solid #ebebed" }}>
                {[
                  { label: "Target", value: form.target.length > 18 ? form.target.slice(0, 10) + "..." + form.target.slice(-8) : form.target, mono: true },
                  { label: "Amount", value: `${form.amount} XLM`, mono: true },
                  { label: "Action", value: actionTypes.find((a) => a.value === form.action)?.label || form.action, mono: true },
                  { label: "Risk Score", value: String(result.score), mono: true, amber: true },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span style={{ color: "#a1a1aa" }}>{row.label}</span>
                    <span className={row.mono ? "font-mono text-xs" : "text-xs"} style={{ color: row.amber ? "#854d0e" : "#0f0f10" }}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleApproval("rejected")} className="flex-1 h-12 rounded-2xl text-sm transition-colors" style={{ backgroundColor: "#f7f7f8", color: "#52525b" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#efefff")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f8")}>Cancel</button>
                <button onClick={() => handleApproval("approved")} className="flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-colors" style={{ backgroundColor: "#166534" }}>
                  Approve<ShieldAlert className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
