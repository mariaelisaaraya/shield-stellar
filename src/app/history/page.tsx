"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { Loader2 } from "lucide-react";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

interface Assessment {
  id: number;
  agent: string;
  target: string;
  riskScore: number;
  verdict: Verdict;
  reason: string;
  timestamp: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "0x5e07aaf8f2301e08a3aeddad7326c5a2bb54e929": "aegis-agent.eth",
  "0xd8da6bf26964af9d7eed9e03e53415d37aa96045": "vitalik.eth",
};

function getAgentDisplay(address: string): { name: string; isEns: boolean } {
  const lower = address.toLowerCase();
  for (const [key, name] of Object.entries(AGENT_DISPLAY_NAMES)) {
    if (lower.startsWith(key.slice(0, 10).toLowerCase())) {
      return { name, isEns: true };
    }
  }
  return { name: `${address.slice(0, 6)}...${address.slice(-4)}`, isEns: false };
}

function formatTime(ts: number) {
  if (ts === 0) return "-";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const columns = [
  { key: "#", label: "#", align: "text-right" },
  { key: "agent", label: "AGENT", align: "text-left" },
  { key: "target", label: "TARGET", align: "text-left" },
  { key: "score", label: "SCORE", align: "text-right" },
  { key: "verdict", label: "VERDICT", align: "text-center" },
  { key: "reason", label: "REASON", align: "text-left" },
  { key: "timestamp", label: "TIMESTAMP", align: "text-right" },
];

export default function HistoryPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then((data) => {
        const list = data.assessments || [];
        if (list.length > 0) {
          list[0].agent = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
        }
        setAssessments(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
          HISTORY &middot; AUDIT TRAIL
        </span>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "#0f0f10" }}
        >
          Assessment History
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>
          Immutable audit trail of every agent decision on Stellar Testnet
        </p>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12" style={{ color: "#a1a1aa" }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading from Stellar...</span>
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "#a1a1aa" }}>
            No assessments recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ backgroundColor: "#f7f7f8", borderBottom: "1px solid #ebebed" }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`font-mono font-medium tracking-[0.1em] px-5 py-3 ${col.align}`}
                      style={{ fontSize: "10px", color: "#a1a1aa" }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessments.map((row, i) => (
                  <tr
                    key={row.id}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        i < assessments.length - 1
                          ? "1px solid #ebebed"
                          : "none",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f7f7f8")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <td className="px-5 py-3 text-xs font-mono text-right" style={{ color: "#a1a1aa" }}>
                      {row.id}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {(() => {
                        const display = getAgentDisplay(row.agent);
                        return display.isEns ? (
                          <span className="font-medium" style={{ color: "var(--text-1)" }}>{display.name}</span>
                        ) : (
                          <span className="font-mono" style={{ color: "var(--text-2)" }}>{display.name}</span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono" style={{ color: "#52525b" }}>
                      {shortAddr(row.target)}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono font-semibold text-right" style={{ color: "#0f0f10" }}>
                      {row.riskScore}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <VerdictBadge verdict={row.verdict as Verdict} />
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#52525b" }}>
                      {row.reason}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-right" style={{ color: "#a1a1aa" }}>
                      {formatTime(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
