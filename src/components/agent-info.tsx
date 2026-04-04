"use client";

import { useState } from "react";
import { RefreshCw, ChevronUp } from "lucide-react";

export function AgentInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #ebebed" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-2 py-2 text-[10px] font-mono tracking-widest transition-colors"
        style={{ color: "#a1a1aa", backgroundColor: "#ffffff" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#5b5cf6"; e.currentTarget.style.backgroundColor = "#f7f7f8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#a1a1aa"; e.currentTarget.style.backgroundColor = "#ffffff"; }}
      >
        <RefreshCw className="w-3 h-3" />
        AGENT-FRIENDLY INFORMATION
        <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <div className="overflow-y-auto" style={{ backgroundColor: "#ffffff", maxHeight: "320px" }}>
          <div className="px-4 py-4 space-y-3" style={{ maxWidth: "720px", margin: "0 auto" }}>

            {/* Identity */}
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <span className="font-mono" style={{ color: "#5b5cf6" }}>Name</span>
              <span style={{ color: "#52525b" }}>AegisPay</span>
              <span className="font-mono" style={{ color: "#5b5cf6" }}>Type</span>
              <span style={{ color: "#52525b" }}>Trust Layer for Autonomous AI Agents</span>
              <span className="font-mono" style={{ color: "#5b5cf6" }}>Network</span>
              <span style={{ color: "#52525b" }}>Hedera (EVM-compatible, Chain 296)</span>
            </div>

            <div className="h-px" style={{ backgroundColor: "#ebebed" }} />

            {/* Purpose */}
            <p className="text-xs leading-relaxed" style={{ color: "#52525b" }}>
              <span className="font-mono" style={{ color: "#5b5cf6" }}>Purpose </span>
              Evaluate risk before an AI agent executes a payment. Score the transaction, apply a configurable policy, and record every decision on-chain.
            </p>

            <div className="h-px" style={{ backgroundColor: "#ebebed" }} />

            {/* Core Capabilities */}
            <div>
              <span className="text-[10px] font-mono tracking-widest" style={{ color: "#5b5cf6" }}>CAPABILITIES</span>
              <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {[
                  "Risk scoring (0-100) based on amount, address reputation, history",
                  "On-chain policy engine: ALLOW, WARN, BLOCK",
                  "Human-in-the-loop via Ledger hardware wallet",
                  "Immutable on-chain audit trail",
                  "Agent identity registration (ERC-8004)",
                  "ERC-7730 Clear Signing for Ledger",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#52525b" }}>
                    <span className="mt-1.5 block h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: "#d4d4d8" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-px" style={{ backgroundColor: "#ebebed" }} />

            {/* Policy Rules — inline */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="font-mono text-[10px] tracking-widest" style={{ color: "#5b5cf6" }}>POLICY</span>
              <span><span className="font-mono" style={{ color: "#166534" }}>ALLOW</span> <span style={{ color: "#52525b" }}>— below threshold, auto-execute</span></span>
              <span><span className="font-mono" style={{ color: "#854d0e" }}>WARN</span> <span style={{ color: "#52525b" }}>— warning zone, Ledger approval</span></span>
              <span><span className="font-mono" style={{ color: "#dc2626" }}>BLOCK</span> <span style={{ color: "#52525b" }}>— above threshold, denied</span></span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
