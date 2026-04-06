"use client";

import { useState, useEffect, useCallback } from "react";
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
  ArrowRight,
} from "lucide-react";

type StepStatus = "idle" | "active" | "done";

interface FlowStep {
  id: number;
  label: string;
  title: string;
  icon: typeof Send;
  description: string;
  detail: string;
  duration: number; // ms to complete
}

const FLOW_STEPS: FlowStep[] = [
  {
    id: 1,
    label: "STEP 01",
    title: "Agent Request",
    icon: Bot,
    description: "AI agent sends HTTP request to a protected risk assessment endpoint.",
    detail: "GET /api/verdict — standard HTTP, no special headers yet",
    duration: 1200,
  },
  {
    id: 2,
    label: "STEP 02",
    title: "HTTP 402",
    icon: CreditCard,
    description: "Server responds with payment requirements: price, network, and recipient.",
    detail: "402 Payment Required — $0.001 USDC on stellar:testnet",
    duration: 1000,
  },
  {
    id: 3,
    label: "STEP 03",
    title: "Sign & Pay",
    icon: Send,
    description: "Agent signs a Soroban USDC transfer and retries with the payment header.",
    detail: "PAYMENT-SIGNATURE header with signed Stellar transaction (XDR)",
    duration: 1800,
  },
  {
    id: 4,
    label: "STEP 04",
    title: "Facilitate",
    icon: Landmark,
    description: "Facilitator verifies the payment, submits to Stellar, and settles on-chain.",
    detail: "x402.org/facilitator — verify + settle in <5 seconds, fees sponsored",
    duration: 1400,
  },
  {
    id: 5,
    label: "STEP 05",
    title: "Verdict",
    icon: ShieldCheck,
    description: "Agent receives the risk assessment result and acts accordingly.",
    detail: "200 OK — { verdict: \"ALLOW\", score: 25 } + PAYMENT-RESPONSE header",
    duration: 800,
  },
];

function StepCard({
  step,
  status,
  isSelected,
  onClick,
}: {
  step: FlowStep;
  status: StepStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;

  const borderColor =
    status === "done"
      ? "#5b5cf6"
      : status === "active"
        ? "#5b5cf6"
        : isSelected
          ? "#c7d2fe"
          : "#ebebed";

  const bgColor =
    status === "done"
      ? "#efefff"
      : status === "active"
        ? "#ffffff"
        : "#ffffff";

  const labelColor =
    status === "done" ? "#5b5cf6" : status === "active" ? "#5b5cf6" : "#a1a1aa";

  return (
    <motion.button
      onClick={onClick}
      className="relative text-left rounded-2xl p-5 transition-all w-full"
      style={{
        backgroundColor: bgColor,
        border: `1.5px solid ${borderColor}`,
        boxShadow:
          status === "active"
            ? "0 0 0 3px rgba(91,92,246,0.1)"
            : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
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
        style={{ color: labelColor }}
      >
        {step.label}
      </p>
      <p
        className="text-sm font-semibold"
        style={{ color: status === "idle" && !isSelected ? "#a1a1aa" : "#0f0f10" }}
      >
        {step.title}
      </p>
    </motion.button>
  );
}

function ConnectorLine({ status }: { status: StepStatus }) {
  return (
    <div className="hidden sm:flex items-center justify-center" style={{ width: 32 }}>
      <div className="relative w-full h-0.5" style={{ backgroundColor: "#ebebed" }}>
        {status === "done" && (
          <motion.div
            className="absolute inset-0 h-full"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
            style={{ backgroundColor: "#5b5cf6", transformOrigin: "left" }}
          />
        )}
      </div>
    </div>
  );
}

export default function WorkflowPage() {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(
    FLOW_STEPS.map(() => "idle")
  );
  const [selectedStep, setSelectedStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const runFlow = useCallback(async () => {
    setIsRunning(true);
    setIsDone(false);
    setStepStatuses(FLOW_STEPS.map(() => "idle"));

    for (let i = 0; i < FLOW_STEPS.length; i++) {
      setSelectedStep(i);
      setStepStatuses((prev) => {
        const next = [...prev];
        next[i] = "active";
        return next;
      });

      await new Promise((r) => setTimeout(r, FLOW_STEPS[i].duration));

      setStepStatuses((prev) => {
        const next = [...prev];
        next[i] = "done";
        return next;
      });
    }

    setIsRunning(false);
    setIsDone(true);
  }, []);

  const reset = () => {
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setSelectedStep(0);
    setIsDone(false);
  };

  const currentStep = FLOW_STEPS[selectedStep];

  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <span
            className="block font-mono tracking-[0.12em] mb-2 text-xs"
            style={{ color: "#a1a1aa" }}
          >
            x402 &middot; PAYMENT FLOW
          </span>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "#0f0f10" }}
          >
            x402 Payment Flow
          </h1>
          <p
            style={{
              color: "var(--text-3)",
              fontSize: "14px",
              marginTop: "4px",
            }}
          >
            How AI agents pay for risk assessments via HTTP 402 on Stellar
          </p>
        </div>

        {/* Protocol badge */}
        <div
          className="mb-6 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe" }}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs" style={{ color: "#5b5cf6" }}>
              PROTOCOL
            </span>
            <span className="text-xs" style={{ color: "#52525b" }}>
              x402 (HTTP 402 Payment Required)
            </span>
          </div>
          <span style={{ color: "#c7d2fe" }}>|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs" style={{ color: "#5b5cf6" }}>
              NETWORK
            </span>
            <span className="text-xs" style={{ color: "#52525b" }}>
              stellar:testnet
            </span>
          </div>
          <span style={{ color: "#c7d2fe" }}>|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs" style={{ color: "#5b5cf6" }}>
              ASSET
            </span>
            <span className="text-xs" style={{ color: "#52525b" }}>
              USDC
            </span>
          </div>
        </div>

        {/* Step cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {FLOW_STEPS.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              status={stepStatuses[i]}
              isSelected={selectedStep === i}
              onClick={() => setSelectedStep(i)}
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
              style={{ backgroundColor: "#5b5cf6" }}
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
                FLOW SETTLED
              </motion.span>
            )}
          </div>
        </div>

        {/* Selected step detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl p-6 mb-6"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #ebebed",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex w-12 h-12 items-center justify-center rounded-xl shrink-0"
                style={{
                  backgroundColor:
                    stepStatuses[selectedStep] === "done"
                      ? "#5b5cf6"
                      : "#f7f7f8",
                  border:
                    stepStatuses[selectedStep] === "done"
                      ? "none"
                      : "1px solid #ebebed",
                }}
              >
                <currentStep.icon
                  className="w-6 h-6"
                  style={{
                    color:
                      stepStatuses[selectedStep] === "done"
                        ? "#ffffff"
                        : "#52525b",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="font-mono text-[10px] tracking-[0.15em] mb-1"
                  style={{ color: "#5b5cf6" }}
                >
                  {currentStep.label}
                </p>
                <h3
                  className="text-lg font-semibold tracking-tight mb-2"
                  style={{ color: "#0f0f10" }}
                >
                  {currentStep.title}
                </h3>
                <p
                  className="text-sm leading-relaxed mb-3"
                  style={{ color: "#52525b" }}
                >
                  {currentStep.description}
                </p>
                <div
                  className="rounded-lg px-3 py-2 font-mono text-xs"
                  style={{
                    backgroundColor: "#f7f7f8",
                    border: "1px solid #ebebed",
                    color: "#52525b",
                  }}
                >
                  {currentStep.detail}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

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
                  Processing...
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

        {/* Success banner */}
        <AnimatePresence>
          {isDone && (
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
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2
                  className="w-6 h-6"
                  style={{ color: "#166534" }}
                />
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "#166534" }}
                >
                  Payment Settled
                </h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "COST", value: "$0.001" },
                  { label: "SETTLEMENT", value: "<5s" },
                  { label: "NETWORK FEE", value: "~$0.00001" },
                  { label: "VERDICT", value: "ALLOW" },
                ].map((item) => (
                  <div key={item.label}>
                    <p
                      className="font-mono text-[10px] tracking-[0.1em]"
                      style={{ color: "#166534", opacity: 0.6 }}
                    >
                      {item.label}
                    </p>
                    <p
                      className="text-sm font-mono font-semibold"
                      style={{ color: "#166534" }}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
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
