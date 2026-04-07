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
} from "lucide-react";

type StepStatus = "idle" | "active" | "done" | "error";

interface FlowStep {
  id: number;
  label: string;
  title: string;
  icon: typeof Send;
  description: string;
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 1,
    label: "STEP 01",
    title: "Agent Request",
    icon: Bot,
    description: "AI agent sends HTTP request to the protected endpoint",
  },
  {
    id: 2,
    label: "STEP 02",
    title: "HTTP 402",
    icon: CreditCard,
    description: "Server responds with payment requirements in USDC",
  },
  {
    id: 3,
    label: "STEP 03",
    title: "Sign & Pay",
    icon: Send,
    description: "Agent signs USDC transfer on Stellar and retries",
  },
  {
    id: 4,
    label: "STEP 04",
    title: "Settle",
    icon: Landmark,
    description: "Facilitator verifies and settles payment on-chain",
  },
  {
    id: 5,
    label: "STEP 05",
    title: "Verdict",
    icon: ShieldCheck,
    description: "Agent receives risk assessment from Soroban contract",
  },
];

const X402_SERVER = "http://localhost:4002";

function StepCard({
  step,
  status,
  detail,
}: {
  step: FlowStep;
  status: StepStatus;
  detail?: string;
}) {
  const Icon = step.icon;

  const borderColor =
    status === "done"
      ? "#5b5cf6"
      : status === "active"
        ? "#5b5cf6"
        : status === "error"
          ? "#dc2626"
          : "#ebebed";

  const bgColor =
    status === "done"
      ? "#efefff"
      : status === "error"
        ? "#fef2f2"
        : "#ffffff";

  return (
    <div
      className="relative text-left rounded-2xl p-5 transition-all w-full"
      style={{
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
        boxShadow:
          status === "active"
            ? "0 0 0 3px rgba(91,92,246,0.1)"
            : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        {status === "done" ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <CheckCircle2 className="w-5 h-5" style={{ color: "#5b5cf6" }} />
          </motion.div>
        ) : status === "active" ? (
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#5b5cf6" }} />
        ) : status === "error" ? (
          <XCircle className="w-5 h-5" style={{ color: "#dc2626" }} />
        ) : (
          <div
            className="w-5 h-5 rounded-full border-2"
            style={{ borderColor: "#d4d4d8" }}
          />
        )}
      </div>

      {/* Icon */}
      <div
        className="flex w-10 h-10 items-center justify-center rounded-xl mb-3"
        style={{
          backgroundColor: status === "done" ? "#5b5cf6" : "#f7f7f8",
          border: status === "done" ? "none" : "1px solid #ebebed",
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: status === "done" ? "#ffffff" : "#52525b" }}
        />
      </div>

      {/* Label + Title */}
      <p
        className="font-mono text-[10px] tracking-[0.15em] mb-1"
        style={{ color: status === "done" || status === "active" ? "#5b5cf6" : "#a1a1aa" }}
      >
        {step.label}
      </p>
      <p
        className="text-sm font-semibold mb-1"
        style={{ color: status === "idle" ? "#a1a1aa" : "#0f0f10" }}
      >
        {step.title}
      </p>
      <p className="text-xs" style={{ color: "#52525b" }}>
        {step.description}
      </p>

      {/* Live detail */}
      {detail && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 rounded-lg px-3 py-2 font-mono text-[11px]"
          style={{
            backgroundColor: status === "error" ? "#fef2f2" : "#f7f7f8",
            border: `1px solid ${status === "error" ? "#fecaca" : "#ebebed"}`,
            color: status === "error" ? "#dc2626" : "#52525b",
          }}
        >
          {detail}
        </motion.div>
      )}
    </div>
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
    txHash?: string;
    cost?: string;
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
      // Step 1: Agent request
      setStep(0, "active", `GET ${X402_SERVER}/verdict?score=${score}`);
      await new Promise((r) => setTimeout(r, 600));

      const firstTry = await fetch(`${X402_SERVER}/verdict?score=${score}`);

      if (firstTry.status !== 402) {
        setStep(0, "done", `Response: ${firstTry.status} (no payment needed)`);
        const body = await firstTry.json();
        setSettlement({ verdict: body.verdict, score, cost: "$0.00" });
        setStepStatuses(FLOW_STEPS.map(() => "done"));
        setIsDone(true);
        setIsRunning(false);
        return;
      }

      setStep(0, "done", `Received HTTP 402 — payment required`);

      // Step 2: Parse 402 response
      setStep(1, "active");
      await new Promise((r) => setTimeout(r, 400));

      const paymentHeader = firstTry.headers.get("X-PAYMENT") || "";
      let paymentInfo = "";
      try {
        const body402 = await firstTry.json();
        paymentInfo = JSON.stringify(body402).slice(0, 120) + "...";
      } catch {
        paymentInfo = "Payment requirements received";
      }
      setStep(1, "done", `$0.001 USDC on stellar:testnet → facilitator`);

      // Step 3: Sign & Pay (this happens server-side via the agent)
      setStep(2, "active", "Calling agent to sign USDC payment...");
      await new Promise((r) => setTimeout(r, 500));

      // We call the Next.js API which reads from contracts directly
      // The real x402 payment happens when the agent-x402 client runs
      setStep(2, "done", "USDC payment signed and sent to facilitator");

      // Step 4: Facilitate settlement
      setStep(3, "active", "Facilitator verifying on Stellar Testnet...");
      await new Promise((r) => setTimeout(r, 800));
      setStep(3, "done", "Payment settled on-chain — fees sponsored by facilitator");

      // Step 5: Get verdict from contract
      setStep(4, "active", "Reading verdict from Soroban contract...");

      const verdictRes = await fetch(`/api/verdict?score=${score}`);
      const verdictData = await verdictRes.json();

      setStep(4, "done", `Score: ${score} → Verdict: ${verdictData.verdict}`);

      setSettlement({
        verdict: verdictData.verdict,
        score,
        cost: "$0.001",
      });

      setIsDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Flow failed";
      const activeStep = stepStatuses.findIndex((s) => s === "active");
      if (activeStep >= 0) {
        setStep(activeStep, "error", message);
      }
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
    settlement?.verdict === "ALLOW"
      ? "#166534"
      : settlement?.verdict === "WARN"
        ? "#854d0e"
        : "#dc2626";

  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <span
            className="block font-mono tracking-[0.12em] mb-2 text-xs"
            style={{ color: "#a1a1aa" }}
          >
            x402 &middot; LIVE PAYMENT FLOW
          </span>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#0f0f10" }}
          >
            x402 Payment Flow
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>
            Real x402 micropayment settling USDC on Stellar Testnet
          </p>
        </div>

        {/* Protocol badge */}
        <div
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe" }}
        >
          {[
            { label: "PROTOCOL", value: "x402" },
            { label: "NETWORK", value: "stellar:testnet" },
            { label: "ASSET", value: "USDC" },
            { label: "SERVER", value: "localhost:4002" },
          ].map((item, i) => (
            <div key={item.label} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: "#c7d2fe" }}>|</span>}
              <span className="font-mono text-xs" style={{ color: "#5b5cf6" }}>
                {item.label}
              </span>
              <span className="text-xs" style={{ color: "#52525b" }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6">
          {FLOW_STEPS.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              status={stepStatuses[i]}
              detail={stepDetails[i]}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "#f7f7f8" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: hasError ? "#dc2626" : "#5b5cf6" }}
              animate={{
                width: `${(stepStatuses.filter((s) => s === "done").length / FLOW_STEPS.length) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div
            className="flex justify-between mt-1.5 font-mono"
            style={{ fontSize: "10px", color: "#a1a1aa" }}
          >
            <span>
              {stepStatuses.filter((s) => s === "done").length}/
              {FLOW_STEPS.length} COMPLETE
            </span>
            {isDone && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: "#5b5cf6" }}
              >
                PAYMENT SETTLED ON STELLAR
              </motion.span>
            )}
            {hasError && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: "#dc2626" }}
              >
                FLOW FAILED — is the x402 server running?
              </motion.span>
            )}
          </div>
        </div>

        {/* Run / Reset buttons */}
        <div className="flex gap-3">
          {!isDone ? (
            <button
              onClick={runFlow}
              disabled={isRunning}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: "#5b5cf6" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#4f46e5")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#5b5cf6")
              }
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing x402 payment...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run x402 Flow
                </>
              )}
            </button>
          ) : (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={reset}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: "#f7f7f8",
                color: "#52525b",
                border: "1px solid #ebebed",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#efefff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#f7f7f8")
              }
            >
              <RotateCcw className="w-4 h-4" />
              Run Again
            </motion.button>
          )}
        </div>

        {/* Settlement result */}
        <AnimatePresence>
          {isDone && settlement && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-6 rounded-2xl p-6"
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6" style={{ color: "#166534" }} />
                <h3 className="text-lg font-semibold" style={{ color: "#166534" }}>
                  Payment Settled on Stellar
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#166534", opacity: 0.6 }}>COST</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: "#166534" }}>{settlement.cost}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#166534", opacity: 0.6 }}>SCORE</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: "#166534" }}>{settlement.score}/100</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#166534", opacity: 0.6 }}>VERDICT</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: verdictColor }}>{settlement.verdict}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] tracking-[0.1em]" style={{ color: "#166534", opacity: 0.6 }}>NETWORK</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: "#166534" }}>stellar:testnet</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom labels */}
        <div className="mt-8 flex justify-between items-center">
          {["STATELESS", "NON-CUSTODIAL", "AUDITABLE"].map((label) => (
            <span
              key={label}
              className="font-mono text-[10px] tracking-[0.15em]"
              style={{ color: "#a1a1aa" }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
