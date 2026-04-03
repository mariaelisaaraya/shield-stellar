"use client";

import { motion } from "framer-motion";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { AgentIdentity } from "@/components/demos/AgentIdentity";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

const mockHistory = [
  { id: "1", agentId: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", agentAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", target: "0x1a2B...9f4E", score: 92, verdict: "ALLOW" as Verdict, reason: "Low value transfer", timestamp: "2026-04-03 14:32" },
  { id: "2", agentId: "SwapAgent-01", agentAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", target: "0x7cD3...2a1B", score: 67, verdict: "WARN" as Verdict, reason: "Swap requires review", timestamp: "2026-04-03 14:28" },
  { id: "3", agentId: "PaymentBot-v2", agentAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1f1A2", target: "0x3eF1...8c7D", score: 34, verdict: "BLOCK" as Verdict, reason: "Unknown recipient", timestamp: "2026-04-03 14:15" },
  { id: "4", agentId: "StakeManager", agentAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", target: "0x9bA4...1e3F", score: 88, verdict: "ALLOW" as Verdict, reason: "Known target address", timestamp: "2026-04-03 13:55" },
  { id: "5", agentId: "SwapAgent-01", agentAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", target: "0x5dE2...6b8A", score: 45, verdict: "BLOCK" as Verdict, reason: "High value swap", timestamp: "2026-04-03 13:41" },
  { id: "6", agentId: "BridgeBot-v1", agentAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", target: "0x2fC8...4d9E", score: 73, verdict: "WARN" as Verdict, reason: "Elevated amount", timestamp: "2026-04-03 13:22" },
  { id: "7", agentId: "PaymentBot-v2", agentAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f1f1A2", target: "0x8aD6...7f2C", score: 95, verdict: "ALLOW" as Verdict, reason: "Low value transfer", timestamp: "2026-04-03 12:58" },
  { id: "8", agentId: "StakeManager", agentAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", target: "0x4bE9...3a5D", score: 21, verdict: "BLOCK" as Verdict, reason: "Flagged address", timestamp: "2026-04-03 12:30" },
];

const columns = [
  { key: "agentId", label: "AGENT", align: "text-left" },
  { key: "target", label: "TARGET", align: "text-left" },
  { key: "score", label: "SCORE", align: "text-right" },
  { key: "verdict", label: "VERDICT", align: "text-center" },
  { key: "reason", label: "REASON", align: "text-left" },
  { key: "timestamp", label: "TIMESTAMP", align: "text-right" },
];

export default function HistoryPage() {
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
          HISTORY &middot; AUDIT TRAIL
        </span>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "#f0f0f0" }}
        >
          Assessment History
        </h1>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`font-mono font-medium tracking-[0.06em] px-5 py-3 ${col.align}`}
                    style={{ fontSize: "11px", color: "#444" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockHistory.map((row, i) => (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{
                    borderBottom:
                      i < mockHistory.length - 1
                        ? "1px solid #141414"
                        : "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#141414")
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
                  <td className="px-5 py-3 text-sm" style={{ color: "#666" }}>
                    {row.reason}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-right" style={{ color: "#444" }}>
                    {row.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
