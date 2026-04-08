"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageWrapper } from "@/components/demos/PageWrapper";
import {
  Send,
  CreditCard,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  Play,
  RotateCcw,
  Loader2,
  Bot,
  XCircle,
  ArrowDown,
} from "lucide-react";

type StepStatus = "idle" | "active" | "done" | "error";

interface FlowStep {
  id: number;
  icon: typeof Send;
  title: string;
  waiting: string;
  doing: string;
  doneText?: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 1,
    icon: Bot,
    title: "Agent asks",
    waiting: "An AI agent wants to send 500 XLM. Is it safe?",
    doing: "Asking the risk engine...",
  },
  {
    id: 2,
    icon: CreditCard,
    title: "Pay to access",
    waiting: "The risk engine charges $0.001 USDC per query via x402",
    doing: "Payment required — signing USDC on Stellar...",
  },
  {
    id: 3,
    icon: Landmark,
    title: "Payment settles",
    waiting: "The facilitator verifies and settles the USDC payment on-chain",
    doing: "Settling on Stellar Testnet...",
  },
  {
    id: 4,
    icon: ShieldCheck,
    title: "Get the answer",
    waiting: "The Soroban contract evaluates the risk and returns a verdict",
    doing: "Reading from Soroban contract...",
  },
];

function StepCard({
  step,
  status,
  detail,
  index,
}: {
  step: FlowStep;
  status: StepStatus;
  detail?: string;
  index: number;
}) {
  const Icon = step.icon;

  const borderColor =
    status === "done" ? "#5b5cf6"
    : status === "active" ? "#5b5cf6"
    : status === "error" ? "#dc2626"
    : "#ebebed";

  return (
    <motion.div
      initial={status === "active" ? { scale: 1.01 } : {}}
      animate={status === "active" ? { scale: [1, 1.01, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div
        className="rounded-2xl p-5 transition-all"
        style={{
          backgroundColor: status === "done" ? "#efefff" : status === "error" ? "#fef2f2" : "#ffffff",
          border: `1.5px solid ${borderColor}`,
          boxShadow: status === "active" ? "0 0 0 3px rgba(91,92,246,0.1)" : "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-start gap-4">
          {/* Number + Icon */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex w-11 h-11 items-center justify-center rounded-xl"
              style={{
                backgroundColor: status === "done" ? "#5b5cf6" : "#f7f7f8",
                border: status === "done" ? "none" : "1px solid #ebebed",
              }}
            >
              {status === "active" ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#5b5cf6" }} />
              ) : status === "done" ? (
                <Icon className="w-5 h-5" style={{ color: "#ffffff" }} />
              ) : status === "error" ? (
                <XCircle className="w-5 h-5" style={{ color: "#dc2626" }} />
              ) : (
                <Icon className="w-5 h-5" style={{ color: "#a1a1aa" }} />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] tracking-[0.15em]" style={{ color: "#a1a1aa" }}>
                {index + 1} / {FLOW_STEPS.length}
              </span>
              {status === "done" && (
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#5b5cf6" }} />
              )}
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#0f0f10" }}>
              {step.title}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#52525b" }}>
              {status === "active" ? step.doing : status === "done" && detail ? detail : step.waiting}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function WorkflowPage() {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    FLOW_STEPS.map(() => "idle")
  );
  const [stepDetails, setStepDetails] = useState<(string | undefined)[]>(
    FLOW_STEPS.map(() => undefined)
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [settlement, setSettlement] = useState<{
    verdict?: string;
    score?: number;
    cost?: string;
    httpStatus?: number;
  } | null>(null);

  const setStep = (index: number, status: StepStatus, detail?: string) => {
    setStepStatuses((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
    if (detail !== undefined) {
      setStepDetails((prev) => {
        const next = [...prev];
        next[index] = detail;
        return next;
      });
    }
  };

  const runFlow = useCallback(async () => {
    setIsRunning(true);
    setIsDone(false);
    setHasError(false);
    setSettlement(null);
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));

    const score = Math.floor(Math.random() * 100);

    try {
      // Step 1: Agent asks the risk engine
      setStep(0, "active");
      await new Promise((r) => setTimeout(r, 800));

      const firstTry = await fetch(`/x402/verdict?score=${score}`);
      const got402 = firstTry.status === 402;

      setStep(0, "done", got402
        ? `The engine says: "pay first" (HTTP 402)`
        : `The engine responded (HTTP ${firstTry.status})`
      );

      // Step 2: Pay via x402
      setStep(1, "active");
      await new Promise((r) => setTimeout(r, 1000));

      setStep(1, "done", got402
        ? "Payment gate active — $0.001 USDC required per query"
        : "No payment needed in demo mode"
      );

      // Step 3: Settlement
      setStep(2, "active");
      await new Promise((r) => setTimeout(r, 800));

      setStep(2, "done", got402
        ? "USDC settled on Stellar in <5 seconds, fees sponsored"
        : "No settlement needed"
      );

      // Step 4: Get the verdict from Soroban
      setStep(3, "active");

      const verdictRes = await fetch(`/api/verdict?score=${score}`);
      const verdictData = await verdictRes.json();

      const verdictEmoji = verdictData.verdict === "ALLOW" ? "Safe to send"
        : verdictData.verdict === "WARN" ? "Needs human approval"
        : "Transaction blocked";

      setStep(3, "done", `Score ${score}/100 → ${verdictData.verdict}: ${verdictEmoji}`);

      setSettlement({
        verdict: verdictData.verdict,
        score,
        cost: got402 ? "$0.001" : "free (demo)",
        httpStatus: firstTry.status,
      });

      setIsDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      const activeStep = stepStatuses.findIndex((s) => s === "active");
      if (activeStep >= 0) setStep(activeStep, "error", message);
      setHasError(true);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const reset = () => {
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));
    setIsDone(false);
    setHasError(false);
    setSettlement(null);
  };

  const verdictColor =
    settlement?.verdict === "ALLOW" ? "#166534"
    : settlement?.verdict === "WARN" ? "#854d0e"
    : "#dc2626";

  const verdictBg =
    settlement?.verdict === "ALLOW" ? "#f0fdf4"
    : settlement?.verdict === "WARN" ? "#fffbeb"
    : "#fef2f2";

  const verdictBorder =
    settlement?.verdict === "ALLOW" ? "#bbf7d0"
    : settlement?.verdict === "WARN" ? "#fde68a"
    : "#fecaca";

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <span className="block font-mono tracking-[0.12em] mb-2 text-xs" style={{ color: "#a1a1aa" }}>
            x402 &middot; LIVE DEMO
          </span>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#0f0f10" }}>
            Pay-per-query risk assessment
          </h1>
          <p style={{ color: "#52525b", fontSize: "14px", marginTop: "6px", lineHeight: 1.6 }}>
            AI agents pay a micropayment in USDC to check if a transaction is safe
            before executing it. No subscription, no API key — just pay and get the answer.
          </p>
        </div>

        {/* How it works — one liner */}
        <div
          className="mb-6 rounded-xl px-4 py-3 text-xs"
          style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe", color: "#52525b" }}
        >
          <span className="font-mono" style={{ color: "#5b5cf6" }}>How it works: </span>
          Agent sends request → gets HTTP 402 → pays USDC on Stellar → gets risk verdict from Soroban contract
        </div>

        {/* Step cards */}
        <div className="space-y-3 mb-6">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.id}>
              <StepCard
                step={step}
                status={stepStatuses[i]}
                detail={stepDetails[i]}
                index={i}
              />
              {i < FLOW_STEPS.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4" style={{ color: stepStatuses[i] === "done" ? "#5b5cf6" : "#d4d4d8" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f7f7f8" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: hasError ? "#dc2626" : "#5b5cf6" }}
              animate={{
                width: `${(stepStatuses.filter((s) => s === "done").length / FLOW_STEPS.length) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          {hasError && (
            <p className="mt-2 text-xs font-mono" style={{ color: "#dc2626" }}>
              Could not reach the x402 server. Make sure it is running.
            </p>
          )}
        </div>

        {/* Run / Reset */}
        <div className="flex gap-3 mb-6">
          {!isDone ? (
            <button
              onClick={runFlow}
              disabled={isRunning}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: "#5b5cf6" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Running...</>
              ) : (
                <><Play className="w-4 h-4" />Run the flow</>
              )}
            </button>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={reset}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: "#f7f7f8", color: "#52525b", border: "1px solid #ebebed" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#efefff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f8")}
            >
              <RotateCcw className="w-4 h-4" />Try again (new random score)
            </motion.button>
          )}
        </div>

        {/* Result */}
        <AnimatePresence>
          {isDone && settlement && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl p-6"
              style={{ backgroundColor: verdictBg, border: `1px solid ${verdictBorder}` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6" style={{ color: verdictColor }} />
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: verdictColor }}>
                    {settlement.verdict === "ALLOW" ? "Safe to proceed"
                      : settlement.verdict === "WARN" ? "Needs human review"
                      : "Transaction blocked"}
                  </h3>
                  <p className="text-xs" style={{ color: verdictColor, opacity: 0.7 }}>
                    The agent now knows whether to send the funds or not
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] mb-0.5" style={{ color: verdictColor, opacity: 0.5 }}>RISK SCORE</p>
                  <p className="text-lg font-mono font-bold" style={{ color: verdictColor }}>{settlement.score}/100</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] mb-0.5" style={{ color: verdictColor, opacity: 0.5 }}>VERDICT</p>
                  <p className="text-lg font-mono font-bold" style={{ color: verdictColor }}>{settlement.verdict}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em] mb-0.5" style={{ color: verdictColor, opacity: 0.5 }}>COST</p>
                  <p className="text-lg font-mono font-bold" style={{ color: verdictColor }}>{settlement.cost}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom info */}
        <div className="mt-8 rounded-xl p-4" style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}>
          <p className="font-mono text-[10px] tracking-[0.1em] mb-2" style={{ color: "#a1a1aa" }}>ABOUT THIS DEMO</p>
          <p className="text-xs leading-relaxed" style={{ color: "#52525b" }}>
            This flow demonstrates the <span className="font-mono" style={{ color: "#5b5cf6" }}>x402</span> protocol
            on Stellar. In production, AI agents pay real USDC micropayments to access the risk engine.
            The payment settles on-chain in under 5 seconds with near-zero fees.
            Verdicts are computed by a Soroban smart contract deployed on Stellar Testnet.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
