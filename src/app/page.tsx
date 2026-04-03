"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Activity, ShieldOff, TrendingUp, TrendingDown } from "lucide-react";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { AgentIdentity } from "@/components/demos/AgentIdentity";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

const stats = [
  {
    label: "ACTIVE AGENTS",
    value: "3",
    icon: Bot,
    trend: null,
  },
  {
    label: "ASSESSMENTS TODAY",
    value: "47",
    icon: null,
    trend: { value: "+12%", positive: true },
  },
  {
    label: "BLOCKED ACTIONS",
    value: "8",
    icon: null,
    trend: { value: "+3", positive: false },
  },
  {
    label: "AVG RISK SCORE",
    value: "34",
    icon: Activity,
    trend: null,
  },
];

const recentAssessments = [
  { agent: "PaymentBot-v2", agentAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1f1A2", target: "0x1a2B...9f4E", score: 92, verdict: "ALLOW" as Verdict, time: "2 min ago" },
  { agent: "SwapAgent-01", agentAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", target: "0x7cD3...2a1B", score: 67, verdict: "WARN" as Verdict, time: "6 min ago" },
  { agent: "PaymentBot-v2", agentAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1f1A2", target: "0x3eF1...8c7D", score: 34, verdict: "BLOCK" as Verdict, time: "19 min ago" },
  { agent: "StakeManager", agentAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", target: "0x9bA4...1e3F", score: 88, verdict: "ALLOW" as Verdict, time: "39 min ago" },
  { agent: "SwapAgent-01", agentAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", target: "0x5dE2...6b8A", score: 45, verdict: "BLOCK" as Verdict, time: "53 min ago" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function HomePage() {
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
          AEGISPAY &middot; LIVE
        </span>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "#f0f0f0" }}
        >
          Dashboard
        </h1>
      </div>

      {/* Stat cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={item}
            className="rounded-xl p-5"
            style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="font-mono tracking-[0.08em]"
                style={{ fontSize: "11px", color: "#444" }}
              >
                {s.label}
              </span>
              {s.icon && <s.icon className="w-3.5 h-3.5" style={{ color: "#333" }} />}
            </div>
            <div className="flex items-end gap-2">
              <span
                className="font-mono font-semibold"
                style={{ fontSize: "28px", color: "#f0f0f0", lineHeight: 1 }}
              >
                {s.value}
              </span>
              {s.trend && (
                <span
                  className="inline-flex items-center gap-1 font-mono text-[11px] pb-0.5"
                  style={{ color: s.trend.positive ? "#22c55e" : "#ef4444" }}
                >
                  {s.trend.positive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {s.trend.value}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Assessments table */}
      <div
        className="rounded-xl overflow-hidden mb-6"
        style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #1a1a1a" }}>
          <span
            className="font-mono tracking-[0.08em]"
            style={{ fontSize: "11px", color: "#444" }}
          >
            RECENT ASSESSMENTS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                {["Agent", "Target", "Score", "Verdict", "Time"].map((h) => (
                  <th
                    key={h}
                    className={`font-mono font-medium tracking-[0.06em] px-5 py-3 ${
                      h === "Score" || h === "Time"
                        ? "text-right"
                        : h === "Verdict"
                          ? "text-center"
                          : "text-left"
                    }`}
                    style={{ fontSize: "11px", color: "#444" }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAssessments.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{
                    borderBottom:
                      i < recentAssessments.length - 1
                        ? "1px solid #141414"
                        : "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#0f0f0f")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td className="px-5 py-3">
                    <AgentIdentity address={row.agentAddress} />
                  </td>
                  <td className="px-5 py-3 text-sm font-mono" style={{ color: "#555" }}>
                    {row.target}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-right" style={{ color: "#e0e0e0" }}>
                    {row.score}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <VerdictBadge verdict={row.verdict} />
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-right" style={{ color: "#444" }}>
                    {row.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <Link
        href="/simulate"
        className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: "#2563EB" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#4d82f0")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#2563EB")}
      >
        Run Assessment
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );
}
