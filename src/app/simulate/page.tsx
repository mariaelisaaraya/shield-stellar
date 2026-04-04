"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { ArrowRight, ShieldAlert, ShieldOff, Check, X, Loader2, CheckCircle2, Activity } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { assessmentRegistryConfig } from "@/lib/contracts";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

interface SimResult {
  score: number;
  verdict: Verdict;
  reasons: string[];
}

const RISKY_PATTERNS = ["dead", "0000000000000000000000000000000000000000"];
const ACTION_RISK: Record<string, number> = {
  transfer: 0, swap: 10, "contract-call": 15, mint: 10, other: 5,
};

function computeRiskScore(target: string, amount: number, action: string): number {
  let score = 0;
  const addr = target.toLowerCase();
  if (RISKY_PATTERNS.some((p) => addr.includes(p))) score += 60;
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
  const knownAddress = target.toLowerCase().startsWith("0x") && !target.toLowerCase().includes("dead");
  const actionLabel = actionTypes.find((a) => a.value === action)?.label || action;

  return [
    {
      label: `Resolving target address...`,
      result: knownAddress ? "Known contract" : "Unknown address",
      status: knownAddress ? "ok" : "warn",
    },
    {
      label: `Evaluating amount (${amount || "0"} HBAR)...`,
      result: amt > 1000 ? "High value" : amt >= 10 ? "Elevated" : "Low value",
      status: amt > 1000 ? "warn" : amt >= 10 ? "warn" : "ok",
    },
    {
      label: `Analyzing action type (${actionLabel})...`,
      result: action === "contract-call" ? "High risk" : action === "swap" || action === "mint" ? "Requires review" : "Safe action",
      status: action === "contract-call" ? "warn" : action === "swap" || action === "mint" ? "warn" : "ok",
    },
    {
      label: `Applying policy thresholds...`,
      result: "Thresholds loaded",
      status: "ok",
    },
    {
      label: `Computing verdict...`,
      result: "Assessment complete",
      status: "neutral",
    },
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
  "flex h-9 w-full rounded-md border px-3 py-1 font-mono text-sm shadow-sm transition-colors placeholder:text-[#444] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2563EB]/50";

export default function SimulatePage() {
  const [form, setForm] = useState({
    agent: "",
    target: "",
    amount: "",
    action: "transfer",
  });
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [thresholds, setThresholds] = useState<[number, number] | null>(null);
  const [operatorDecision, setOperatorDecision] = useState<
    "approved" | "rejected" | null
  >(null);
  const { address, isConnected } = useAccount();
  const {
    data: txHash,
    writeContract,
    isPending: isRegistering,
    isSuccess: isRegistered,
    error: registerError,
    reset: resetRegister,
  } = useWriteContract();
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [traceProgress, setTraceProgress] = useState(-1); // -1 = idle, 0..4 = animating
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
        // All steps done — show result after a brief pause
        setTimeout(() => {
          const assessment = pendingResult.current;
          if (assessment) {
            setResult(assessment);
            setLoading(false);
            if (assessment.verdict === "WARN") {
              setShowModal(true);
            }
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
    resetRegister();

    // Build and start trace
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
    } catch (err: any) {
      setError(err.message || "Failed to query PolicyManager");
      setLoading(false);
    }
  }

  function handleApproval(decision: "approved" | "rejected") {
    setShowModal(false);
    setOperatorDecision(decision);
  }

  function handleRegister() {
    if (!isConnected || !address || !result) return;

    const normalizedTarget = form.target.toLowerCase() as `0x${string}`;

    writeContract({
      ...assessmentRegistryConfig,
      functionName: "createAssessment",
      args: [
        address,
        normalizedTarget,
        BigInt(result.score),
        result.verdict,
        result.reasons[0],
      ],
    });
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
      {/* Header */}
      <div className="mb-8">
        <span
          className="block font-mono tracking-[0.12em] mb-2"
          style={{ fontSize: "11px", color: "#444" }}
        >
          SIMULATE &middot; RISK ASSESSMENT
        </span>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "#f0f0f0" }}
        >
          Simulate Assessment
        </h1>
      </div>

        {thresholds && (
          <div className="mb-4 flex items-center justify-between rounded-lg px-4 py-2 text-xs font-mono" style={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a", color: "#555" }}>
            <span>Active Policy</span>
            <span>
              <span className="text-emerald-400">ALLOW &lt;{thresholds[0]}</span>{" · "}
              <span className="text-amber-400">WARN {thresholds[0]}-{thresholds[1]}</span>{" · "}
              <span className="text-red-400">BLOCK &gt;{thresholds[1]}</span>
            </span>
          </div>
        )}

        {/* Form */}
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Agent Address */}
            <div className="space-y-2">
              <label
                className="font-mono tracking-[0.06em]"
                style={{ fontSize: "11px", color: "#444" }}
              >
                AGENT ADDRESS
              </label>
              <input
                placeholder="0x... or agent name"
                value={form.agent}
                onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))}
                className={inputClass}
                style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a", color: "#e0e0e0" }}
              />
            </div>

            {/* Target Address */}
            <div className="space-y-2">
              <label
                className="font-mono tracking-[0.06em]"
                style={{ fontSize: "11px", color: "#444" }}
              >
                TARGET ADDRESS
              </label>
              <input
                placeholder="0x..."
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                required
                className={inputClass}
                style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a", color: "#e0e0e0" }}
              />
            </div>

            {/* Amount + Action Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  className="font-mono tracking-[0.06em]"
                  style={{ fontSize: "11px", color: "#444" }}
                >
                  AMOUNT
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    className={inputClass}
                    style={{
                      backgroundColor: "#0a0a0a",
                      borderColor: "#1a1a1a",
                      color: "#e0e0e0",
                      paddingRight: "52px",
                    }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono"
                    style={{ fontSize: "11px", color: "#444" }}
                  >
                    HBAR
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  className="font-mono tracking-[0.06em]"
                  style={{ fontSize: "11px", color: "#444" }}
                >
                  ACTION TYPE
                </label>
                <select
                  value={form.action}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                  className={inputClass}
                  style={{ backgroundColor: "#0a0a0a", borderColor: "#1a1a1a", color: "#e0e0e0" }}
                >
                  {actionTypes.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#2563EB" }}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Assessing…
                </>
              ) : (
                <>
                  Run Assessment
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</div>
        )}

        {/* Assessment Trace */}
        <AnimatePresence>
          {traceVisible && traceSteps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mt-4 rounded-lg"
              style={{ backgroundColor: "#050505", border: "1px solid #1a1a1a", padding: 16 }}
            >
              <span
                className="block font-mono uppercase tracking-[0.14em] mb-4"
                style={{ fontSize: "10px", color: "#444" }}
              >
                Assessment Trace
              </span>

              {/* Steps with vertical line */}
              <div className="relative" style={{ paddingLeft: 20 }}>
                {/* Vertical connector line */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: 5, width: 1, backgroundColor: "#2563EB", opacity: 0.3 }}
                />

                <div className="space-y-3">
                  {traceSteps.map((step, i) => {
                    const isCompleted = i < traceProgress;
                    const isCurrent = i === traceProgress && traceProgress < traceSteps.length;
                    const isVisible = i <= traceProgress;

                    if (!isVisible) return null;

                    const resultColor =
                      step.status === "ok" ? "#16a34a" : step.status === "warn" ? "#d97706" : "#2563EB";

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25 }}
                        className="relative flex items-center justify-between gap-3"
                      >
                        {/* Dot on the vertical line */}
                        <div
                          className="absolute"
                          style={{ left: -19, top: "50%", transform: "translateY(-50%)" }}
                        >
                          {isCurrent ? (
                            <Loader2
                              className="animate-spin"
                              style={{ width: 10, height: 10, color: "#2563EB" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                backgroundColor: resultColor,
                                marginLeft: 1.5,
                              }}
                            />
                          )}
                        </div>

                        {/* Left: number + label */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-mono shrink-0"
                            style={{ fontSize: "12px", color: "#444" }}
                          >
                            {stepNumbers[i]}
                          </span>
                          <span
                            className="font-mono truncate"
                            style={{
                              fontSize: "12px",
                              color: isCompleted ? "#ccc" : "#888",
                            }}
                          >
                            {step.label}
                          </span>
                        </div>

                        {/* Right: result */}
                        {isCompleted && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                            className="font-mono shrink-0"
                            style={{ fontSize: "11px", color: resultColor }}
                          >
                            {step.result}
                          </motion.span>
                        )}
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="mt-4 rounded-xl p-6"
              style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
            >
              {/* Score + Verdict */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm" style={{ color: "#555" }}>Result</span>
                <VerdictBadge verdict={result.verdict} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#555" }}>Risk Score</span>
                  <span className="text-2xl font-bold font-mono" style={{ color: "#f0f0f0" }}>
                    {result.score}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#141414" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.score}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      result.verdict === "ALLOW"
                        ? "bg-emerald-500"
                        : result.verdict === "WARN"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                </div>

                {/* Reasons list */}
                <div className="pt-2 space-y-1.5">
                  {result.reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 block h-1.5 w-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            result.verdict === "ALLOW"
                              ? "#22c55e"
                              : result.verdict === "WARN"
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      />
                      <span className="text-xs leading-relaxed" style={{ color: "#888" }}>
                        {r}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operator decision banner */}
              <AnimatePresence>
                {operatorDecision && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                      operatorDecision === "approved"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {operatorDecision === "approved" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {operatorDecision === "approved"
                      ? "Approved via Ledger Secure Flow"
                      : "Rejected — transaction cancelled"}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* BLOCK message */}
              {result.verdict === "BLOCK" && (
                <div
                  className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium border-red-500/30 bg-red-500/10 text-red-400"
                >
                  <ShieldOff className="w-4 h-4 shrink-0" />
                  Transfer blocked by AegisPay
                </div>
              )}

              {/* Register button */}
              <AnimatePresence>
                {showRegisterButton && !isRegistered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.25 }}
                    className="mt-4"
                  >
                    <button
                      onClick={handleRegister}
                      disabled={isRegistering}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#2563EB" }}
                    >
                      {isRegistering ? "Registering on Hedera..." : "Register Assessment on Hedera"}
                    </button>
                  </motion.div>
                )}
                {isRegistered && txHash && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Assessment registered on Hedera ✓ tx: {txHash.slice(0, 6)}...{txHash.slice(-4)}
                  </motion.div>
                )}
                {isRegistered && txHash && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      onClick={() => { setResult(null); setOperatorDecision(null); resetRegister(); setForm({ agent: "", target: "", amount: "", action: "transfer" }); }}
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:opacity-90"
                      style={{ backgroundColor: "#1a1a1a", color: "#888", border: "1px solid #333" }}
                    >
                      <Activity className="w-4 h-4" />New Assessment
                    </button>
                  </motion.div>
                )}
                {registerError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400"
                  >
                    {registerError.message.length > 120
                      ? registerError.message.slice(0, 120) + "..."
                      : registerError.message}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Human Approval Modal */}
        <AnimatePresence>
          {showModal && result && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
            >
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => handleApproval("rejected")}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl"
                style={{ backgroundColor: "#0a0a0a", border: "1px solid #222" }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex w-12 h-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)" }}
                  >
                    <ShieldAlert className="text-emerald-400 w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
                      Human Approval Required
                    </h2>
                    <p className="text-sm font-mono" style={{ color: "#555" }}>
                      Ledger Secure Flow
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-6 mb-6"
                  style={{ backgroundColor: "#111", border: "1px solid #1a1a1a" }}
                >
                  <p className="text-sm mb-4" style={{ color: "#999" }}>
                    This action has <span className="text-amber-400 font-semibold">medium</span> risk. Ledger requires human approval before moving funds.
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4 mb-6 space-y-2"
                  style={{ backgroundColor: "#0a0a0a", border: "1px solid #1a1a1a" }}
                >
                  {[
                    { label: "Target", value: form.target.length > 18 ? form.target.slice(0, 10) + "..." + form.target.slice(-8) : form.target, mono: true },
                    { label: "Amount", value: `${form.amount} HBAR`, mono: true },
                    { label: "Action", value: actionTypes.find((a) => a.value === form.action)?.label || form.action, mono: true },
                    { label: "Risk Score", value: String(result.score), mono: true, amber: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span style={{ color: "#555" }}>{row.label}</span>
                      <span
                        className={row.mono ? "font-mono text-xs" : "text-xs"}
                        style={{ color: row.amber ? "#f59e0b" : "#ccc" }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApproval("rejected")}
                    className="flex-1 h-12 rounded-2xl text-sm transition-colors"
                    style={{ backgroundColor: "#1a1a1a", color: "#888" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#222")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1a1a1a")}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApproval("approved")}
                    className="flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-colors"
                    style={{ backgroundColor: "#16a34a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#15803d")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
                  >
                    Approve with Ledger
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-center text-xs mt-5" style={{ color: "#333" }}>
                  In production, this approval would require a physical Ledger device for Clear Signing
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </motion.div>
  );
}
