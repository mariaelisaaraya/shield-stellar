"use client";

import { PageWrapper } from "@/components/demos/PageWrapper";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { Shield } from "lucide-react";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

const mockHistory = [
  { id: "1", agentId: "PaymentBot-v2", target: "0x1a2B...9f4E", score: 92, verdict: "ALLOW" as Verdict, timestamp: "2026-04-03 14:32" },
  { id: "2", agentId: "SwapAgent-01", target: "0x7cD3...2a1B", score: 67, verdict: "WARN" as Verdict, timestamp: "2026-04-03 14:28" },
  { id: "3", agentId: "PaymentBot-v2", target: "0x3eF1...8c7D", score: 34, verdict: "BLOCK" as Verdict, timestamp: "2026-04-03 14:15" },
  { id: "4", agentId: "StakeManager", target: "0x9bA4...1e3F", score: 88, verdict: "ALLOW" as Verdict, timestamp: "2026-04-03 13:55" },
  { id: "5", agentId: "SwapAgent-01", target: "0x5dE2...6b8A", score: 45, verdict: "BLOCK" as Verdict, timestamp: "2026-04-03 13:41" },
  { id: "6", agentId: "BridgeBot-v1", target: "0x2fC8...4d9E", score: 73, verdict: "WARN" as Verdict, timestamp: "2026-04-03 13:22" },
  { id: "7", agentId: "PaymentBot-v2", target: "0x8aD6...7f2C", score: 95, verdict: "ALLOW" as Verdict, timestamp: "2026-04-03 12:58" },
  { id: "8", agentId: "StakeManager", target: "0x4bE9...3a5D", score: 21, verdict: "BLOCK" as Verdict, timestamp: "2026-04-03 12:30" },
];

export default function HistoryPage() {
  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/50">
            <Shield className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Assessment History
            </h1>
            <p className="text-sm text-muted-foreground">
              Audit trail of all risk assessments
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 font-mono">
                    Agent
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 font-mono">
                    Target
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 font-mono">
                    Score
                  </th>
                  <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3 font-mono">
                    Verdict
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 font-mono">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockHistory.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      {row.agentId}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                      {row.target}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-right">
                      {row.score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <VerdictBadge verdict={row.verdict} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono text-right">
                      {row.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
