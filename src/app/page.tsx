"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Activity, ShieldOff, Loader2 } from "lucide-react";
import { VerdictBadge } from "@/components/demos/VerdictBadge";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

interface Assessment {
  agent: string;
  target: string;
  riskScore: number;
  verdict: Verdict;
  timestamp: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
  if (ts === 0) return "-";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function HomePage() {
  const [stats, setStats] = useState({ agentCount: 0, total: 0, blocked: 0, avgScore: 0 });
  const [recent, setRecent] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setRecent(data.recent || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cards: { label: string; value: number; icon: typeof Bot | null; sub: string; subColor?: string }[] = [
    { label: "REGISTERED AGENTS", value: stats.agentCount, icon: Bot, sub: "active on Stellar Testnet" },
    { label: "TOTAL ASSESSMENTS", value: stats.total, icon: null, sub: "risk evaluations recorded on-chain" },
    { label: "BLOCKED ACTIONS", value: stats.blocked, icon: ShieldOff, sub: "transactions prevented" },
    { label: "AVG RISK SCORE", value: stats.avgScore, icon: Activity, sub: "across all assessments" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="mb-8">
        <span
          className="block font-mono tracking-[0.12em] mb-2 text-xs"
          style={{ color: "#a1a1aa" }}
        >
          SHIELDSTELLAR &middot; STELLAR TESTNET
        </span>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "#0f0f10" }}
        >
          Dashboard
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>
          Monitor your AI agents in real time on Stellar Testnet
        </p>
      </div>

      {/* Stat cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
      >
        {cards.map((s) => (
          <motion.div
            key={s.label}
            variants={item}
            className="p-6"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #ebebed",
              borderRadius: "14px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="font-mono tracking-[0.12em]"
                style={{ fontSize: "10px", color: "#a1a1aa" }}
              >
                {s.label}
              </span>
              {s.icon && <s.icon className="w-3.5 h-3.5" style={{ color: "#a1a1aa" }} />}
            </div>
            <span
              className="text-4xl font-bold"
              style={{ color: "#0f0f10", lineHeight: 1 }}
            >
              {loading ? "..." : s.value}
            </span>
            <p style={{ color: s.subColor || "var(--text-3)", fontSize: "12px", marginTop: "6px", fontWeight: s.subColor ? 500 : 400 }}>
              {s.sub}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent Assessments table */}
      <div
        className="overflow-hidden mb-6"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #ebebed",
          borderRadius: "12px",
        }}
      >
        <div
          className="px-5 py-4"
          style={{ backgroundColor: "#f7f7f8", borderBottom: "1px solid #ebebed" }}
        >
          <span
            className="font-mono tracking-[0.1em]"
            style={{ fontSize: "10px", color: "#a1a1aa" }}
          >
            RECENT ASSESSMENTS
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8" style={{ color: "#a1a1aa" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading from Stellar...</span>
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: "#a1a1aa" }}>
            No assessments yet.{" "}
            <Link href="/simulate" style={{ color: "#5b5cf6" }} className="hover:underline">
              Run one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr style={{ borderBottom: "1px solid #ebebed" }}>
                  {["Agent", "Target", "Score", "Verdict", "Time"].map((h) => (
                    <th
                      key={h}
                      className={`font-mono font-medium tracking-[0.1em] px-5 py-3 ${
                        h === "Score" || h === "Time"
                          ? "text-right"
                          : h === "Verdict"
                            ? "text-center"
                            : "text-left"
                      }`}
                      style={{ fontSize: "10px", color: "#a1a1aa" }}
                    >
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((row, i) => (
                  <tr
                    key={i}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        i < recent.length - 1
                          ? "1px solid #ebebed"
                          : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f8")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td className="px-5 py-3 text-sm font-mono" style={{ color: "#52525b" }}>
                      {shortAddr(row.agent)}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono" style={{ color: "#52525b" }}>
                      {shortAddr(row.target)}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-right" style={{ color: "#0f0f10" }}>
                      {row.riskScore}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-right" style={{ color: "#a1a1aa" }}>
                      {timeAgo(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        href="/simulate"
        className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: "#5b5cf6" }}
      >
        Run Assessment
        <ArrowRight className="w-4 h-4" />
      </Link>
    </motion.div>
  );
}
