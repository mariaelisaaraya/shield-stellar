"use client";

import { useState } from "react";
import { RefreshCw, ChevronUp } from "lucide-react";

const SPEC_SECTIONS = [
  {
    title: "Identity",
    items: [
      { label: "Name", value: "AegisPay" },
      { label: "Type", value: "Trust Layer for Autonomous AI Agents" },
      { label: "Network", value: "Hedera (EVM-compatible, Chain 296)" },
    ],
  },
  {
    title: "Purpose",
    text: "Evaluate risk before an AI agent executes a payment. Score the transaction, apply a configurable policy, and record every decision on-chain as an immutable audit trail.",
  },
  {
    title: "Core Capabilities",
    bullets: [
      "Risk scoring (0-100) based on amount, address reputation, and interaction history",
      "On-chain policy engine with three verdicts: ALLOW, WARN, BLOCK",
      "Human-in-the-loop via Ledger hardware wallet for medium-risk transactions",
      "Immutable on-chain audit trail of every agent decision",
      "On-chain agent identity registration (ERC-8004 pattern)",
      "ERC-7730 Clear Signing so Ledger displays human-readable transaction details",
    ],
  },
  {
    title: "Policy Rules",
    items: [
      { label: "ALLOW", value: "Risk score below low threshold — agent executes autonomously" },
      { label: "WARN", value: "Risk score in warning zone — requires human approval on Ledger device" },
      { label: "BLOCK", value: "Risk score above high threshold — transfer denied, no funds moved" },
    ],
  },
  {
    title: "Risk Factors",
    bullets: [
      "Transaction amount (higher = more risk)",
      "Target address reputation (known risky addresses flagged)",
      "Trusted address list (reduces score)",
      "First interaction with target (increases score)",
    ],
  },
  {
    title: "Security Model",
    bullets: [
      "Agents cannot bypass the policy engine — every transfer requires a verdict",
      "WARN verdicts freeze funds until a human physically approves on a Ledger device",
      "All assessments are permanently recorded on-chain with full context",
      "Policy thresholds are owner-configurable and stored on-chain",
      "Clear Signing ensures the signer sees exactly what they approve, not raw calldata",
    ],
  },
  {
    title: "Integration",
    items: [
      { label: "Agent SDK", value: "Hedera Agent Kit (AgentMode.AUTONOMOUS)" },
      { label: "Wallet", value: "Ledger Wallet Provider (EIP-6963 auto-discovery)" },
      { label: "Signing", value: "ERC-7730 Clear Signing JSON for all contracts" },
      { label: "Chain", value: "Hedera Testnet EVM via JSON-RPC relay" },
    ],
  },
];

export function AgentInfo() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #1a1a1a" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-2 py-2.5 text-xs font-mono tracking-widest transition-colors"
        style={{ color: open ? "#888" : "#444", backgroundColor: "#050505" }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0d0d0d")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#050505")}
      >
        <RefreshCw className="w-3 h-3" />
        AGENT-FRIENDLY INFORMATION
        <ChevronUp className={`w-3 h-3 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <div className="overflow-y-auto" style={{ backgroundColor: "#050505", maxHeight: "80vh" }}>
          <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
                AegisPay — Agent Readable Spec
              </h2>
              <p className="text-xs font-mono" style={{ color: "#444" }}>
                Structured reference for AI agents, copilots, and developer tools
              </p>
            </div>
            <div className="h-px" style={{ backgroundColor: "#1a1a1a" }} />
            {SPEC_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-xs font-mono tracking-widest" style={{ color: "#2563EB" }}>
                  {section.title.toUpperCase()}
                </h3>
                {"text" in section && section.text && (
                  <p className="text-sm leading-relaxed" style={{ color: "#999" }}>{section.text}</p>
                )}
                {"items" in section && section.items && (
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div key={item.label} className="flex gap-3 text-sm">
                        <span className="shrink-0 font-mono" style={{ color: "#555", minWidth: "100px" }}>{item.label}</span>
                        <span style={{ color: "#ccc" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {"bullets" in section && section.bullets && (
                  <ul className="space-y-1.5">
                    {section.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "#999" }}>
                        <span className="mt-2 block h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: "#333" }} />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <div className="h-px" style={{ backgroundColor: "#1a1a1a" }} />
            <p className="text-center text-xs font-mono" style={{ color: "#333" }}>Built at ETHGlobal Cannes 2026</p>
          </div>
        </div>
      )}
    </div>
  );
}
