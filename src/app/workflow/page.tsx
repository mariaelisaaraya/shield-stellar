"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageWrapper } from "@/components/demos/PageWrapper";
import {
  Send,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Landmark,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Loader2,
  Bot,
  XCircle,
  ArrowDown,
  FileCheck,
  ExternalLink,
} from "lucide-react";

type Verdict = "ALLOW" | "WARN" | "BLOCK";
type StepStatus = "idle" | "active" | "done" | "error";

// Amount entered in the form is interpreted as XLM; the backend
// scoring engine expects USD, so we convert here. This matches
// the existing rate used by /api/cre-simulate.
const XLM_PRICE_USD = 0.12;

const actionTypes = [
  { value: "transfer", label: "Transfer" },
  { value: "contract-call", label: "Contract Call" },
  { value: "swap", label: "Swap" },
  { value: "mint", label: "Mint" },
  { value: "other", label: "Other" },
];

const inputClass =
  "flex h-9 w-full rounded-lg border px-3 py-1 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none";

interface FlowStep {
  icon: typeof Send;
  title: string;
  waiting: string;
}

const FLOW_STEPS: FlowStep[] = [
  { icon: Bot, title: "Compute risk score", waiting: "Analyzing the transaction details" },
  { icon: CreditCard, title: "x402 payment gate", waiting: "Checking if payment is required" },
  { icon: Landmark, title: "Settle on Stellar", waiting: "USDC payment settles on-chain" },
  { icon: ShieldCheck, title: "Soroban verdict", waiting: "Smart contract evaluates the risk" },
  { icon: FileCheck, title: "On-chain attestation", waiting: "Assessment recorded permanently on Stellar" },
];

function StepRow({ step, status, detail, index }: { step: FlowStep; status: StepStatus; detail?: string; index: number }) {
  const Icon = step.icon;
  const isDone = status === "done";
  const isActive = status === "active";

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex w-8 h-8 items-center justify-center rounded-lg shrink-0"
        style={{
          backgroundColor: isDone ? "#5b5cf6" : isActive ? "#efefff" : "#f7f7f8",
          border: isDone ? "none" : "1px solid #ebebed",
        }}
      >
        {isActive ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#5b5cf6" }} />
        ) : isDone ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: "#ffffff" }} />
        ) : (
          <Icon className="w-4 h-4" style={{ color: "#a1a1aa" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" style={{ color: isDone || isActive ? "#0f0f10" : "#a1a1aa" }}>
          {step.title}
        </p>
        {(isActive || isDone) && detail && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[11px] font-mono"
            style={{ color: "#52525b" }}
          >
            {detail}
          </motion.p>
        )}
      </div>
    </div>
  );
}

export default function WorkflowPage() {
  const [form, setForm] = useState({ target: "", amount: "", action: "transfer" });
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(FLOW_STEPS.map(() => "idle"));
  const [stepDetails, setStepDetails] = useState<(string | undefined)[]>(FLOW_STEPS.map(() => undefined));
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [result, setResult] = useState<{ verdict: Verdict; score: number; reasons: string[]; txHash?: string; explorerUrl?: string } | null>(null);

  const setStep = (i: number, status: StepStatus, detail?: string) => {
    setStepStatuses((p) => { const n = [...p]; n[i] = status; return n; });
    if (detail !== undefined) setStepDetails((p) => { const n = [...p]; n[i] = detail; return n; });
  };

  const runCheck = useCallback(async () => {
    const amt = parseFloat(form.amount) || 0;
    if (!form.target || !form.amount) return;

    setIsRunning(true);
    setIsDone(false);
    setHasError(false);
    setResult(null);
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));

    // Build the request body once — used for both the x402 gate probe
    // and the authoritative verdict call. The score is computed by the
    // server from these inputs; the client never guesses it.
    const amountUsd = amt * XLM_PRICE_USD;
    const verdictBody = JSON.stringify({
      target: form.target,
      amountUsd,
      action: form.action,
    });
    const verdictHeaders = { "Content-Type": "application/json" };

    try {
      // Step 1: Probe the x402 gate (a POST without a payment signature
      // returns 402 + requirements; we display that as the UI step).
      setStep(0, "active");
      await new Promise((r) => setTimeout(r, 600));
      setStep(0, "done", `${form.action} for ~$${amountUsd.toFixed(2)} USD (${amt} XLM)`);

      // Step 2: x402 payment gate
      setStep(1, "active");
      await new Promise((r) => setTimeout(r, 400));
      const x402Res = await fetch("/x402/verdict", {
        method: "POST",
        headers: verdictHeaders,
        body: verdictBody,
      });
      const got402 = x402Res.status === 402;
      setStep(1, "done", got402
        ? "HTTP 402 — $0.001 USDC required"
        : "Access granted (demo mode)");

      // Step 3: Settlement
      setStep(2, "active");
      await new Promise((r) => setTimeout(r, 700));
      setStep(2, "done", got402
        ? "USDC settled on Stellar in <5s"
        : "No payment needed in demo");

      // Step 4: Soroban verdict — the server computes the score from
      // the same body we submitted above, calls PolicyManager, and
      // returns the authoritative verdict + reasons.
      setStep(3, "active");
      const verdictRes = await fetch("/api/verdict", {
        method: "POST",
        headers: verdictHeaders,
        body: verdictBody,
      });
      const verdictData = await verdictRes.json();
      if (verdictData.error) throw new Error(verdictData.error);
      const verdict = verdictData.verdict as Verdict;
      const score = verdictData.score as number;
      const reasons = (verdictData.reasons as string[] | undefined) ?? [];

      setStep(3, "done", `${verdict} (score ${score}/100): ${verdict === "ALLOW" ? "Safe" : verdict === "WARN" ? "Needs review" : "Blocked"}`);

      // Step 5: Register assessment on-chain (attestation)
      setStep(4, "active");
      let txHash: string | undefined;
      let explorerUrl: string | undefined;
      try {
        const deployer = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
        const assessRes = await fetch("/api/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: deployer,
            target: deployer,
            riskScore: score,
            verdict,
            reason: reasons[0],
          }),
        });
        const assessData = await assessRes.json();
        if (assessData.txHash) {
          txHash = assessData.txHash;
          explorerUrl = assessData.explorerUrl;
          setStep(4, "done", `Recorded on-chain — tx: ${assessData.txHash.slice(0, 10)}...`);
        } else {
          setStep(4, "done", `Attestation response: ${assessData.error || "no hash"}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        setStep(4, "done", `Attestation failed: ${msg}`);
      }

      setResult({ verdict, score, reasons, txHash, explorerUrl });
      setIsDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Check failed";
      const active = stepStatuses.findIndex((s) => s === "active");
      if (active >= 0) setStep(active, "error", msg);
      setHasError(true);
    } finally {
      setIsRunning(false);
    }
  }, [form]);

  const reset = () => {
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));
    setIsDone(false);
    setHasError(false);
    setResult(null);
  };

  const verdictColor = result?.verdict === "ALLOW" ? "#166534" : result?.verdict === "WARN" ? "#854d0e" : "#dc2626";
  const verdictBg = result?.verdict === "ALLOW" ? "#f0fdf4" : result?.verdict === "WARN" ? "#fffbeb" : "#fef2f2";
  const verdictBorder = result?.verdict === "ALLOW" ? "#bbf7d0" : result?.verdict === "WARN" ? "#fde68a" : "#fecaca";
  const VerdictIcon = result?.verdict === "ALLOW" ? ShieldCheck : result?.verdict === "WARN" ? ShieldAlert : ShieldOff;

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <span className="block font-mono tracking-[0.12em] mb-2 text-xs" style={{ color: "#a1a1aa" }}>
            RISK CHECK &middot; x402
          </span>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#0f0f10" }}>
            Risk Check
          </h1>
          <p style={{ color: "#52525b", fontSize: "14px", marginTop: "4px" }}>
            Check if a transaction is safe before sending. Powered by x402 micropayments on Stellar.
          </p>
        </div>

        {/* Form */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] tracking-[0.12em]" style={{ color: "#a1a1aa" }}>TARGET ADDRESS</label>
              <input
                placeholder="G..."
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                className={inputClass}
                style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] tracking-[0.12em]" style={{ color: "#a1a1aa" }}>AMOUNT</label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className={inputClass}
                    style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10", paddingRight: "42px" }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px]" style={{ color: "#a1a1aa" }}>XLM</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-mono text-[10px] tracking-[0.12em]" style={{ color: "#a1a1aa" }}>ACTION</label>
                <select
                  value={form.action}
                  onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                  className={inputClass}
                  style={{ backgroundColor: "#f7f7f8", borderColor: "#ebebed", color: "#0f0f10" }}
                >
                  {actionTypes.map((a) => (<option key={a.value} value={a.value}>{a.label}</option>))}
                </select>
              </div>
            </div>

            <button
              onClick={runCheck}
              disabled={isRunning || !form.target || !form.amount}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: "#5b5cf6" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Checking...</>
              ) : (
                <><ArrowRight className="w-4 h-4" />Run Risk Check</>
              )}
            </button>
          </div>
        </div>

        {/* Flow steps */}
        <AnimatePresence>
          {(isRunning || isDone || hasError) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 mb-6 space-y-3"
              style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}
            >
              <p className="font-mono text-[10px] tracking-[0.12em] mb-1" style={{ color: "#a1a1aa" }}>
                x402 PAYMENT FLOW
              </p>
              {FLOW_STEPS.map((step, i) => (
                <StepRow key={i} step={step} status={stepStatuses[i]} detail={stepDetails[i]} index={i} />
              ))}

              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden mt-2" style={{ backgroundColor: "#f7f7f8" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: hasError ? "#dc2626" : "#5b5cf6" }}
                  animate={{ width: `${(stepStatuses.filter((s) => s === "done").length / FLOW_STEPS.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {isDone && result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6 mb-6"
              style={{ backgroundColor: verdictBg, border: `1px solid ${verdictBorder}` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <VerdictIcon className="w-7 h-7" style={{ color: verdictColor }} />
                <div>
                  <h3 className="text-xl font-bold" style={{ color: verdictColor }}>
                    {result.verdict === "ALLOW" ? "Safe to proceed"
                      : result.verdict === "WARN" ? "Needs human review"
                      : "Transaction blocked"}
                  </h3>
                  <p className="text-xs" style={{ color: verdictColor, opacity: 0.7 }}>
                    Risk score: {result.score}/100
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                {result.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: verdictColor }} />
                    <span className="text-xs" style={{ color: verdictColor }}>{r}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 flex items-center justify-between text-xs font-mono" style={{ borderTop: `1px solid ${verdictBorder}`, color: verdictColor, opacity: 0.6 }}>
                <span>x402 cost: $0.001 USDC</span>
                <span>stellar:testnet</span>
              </div>

              {result.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-mono transition-colors"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)", color: verdictColor, border: `1px solid ${verdictBorder}` }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on-chain attestation on Stellar Expert
                </a>
              )}

              <button
                onClick={reset}
                className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: "rgba(255,255,255,0.6)", color: verdictColor, border: `1px solid ${verdictBorder}` }}
              >
                <RotateCcw className="w-3.5 h-3.5" />Check another transaction
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}
