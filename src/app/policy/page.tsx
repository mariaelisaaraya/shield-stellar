"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { VerdictBadge } from "@/components/demos/VerdictBadge";
import { Loader2 } from "lucide-react";

export default function PolicyPage() {
  const [thresholds, setThresholds] = useState<{ low: number; medium: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/thresholds")
      .then((r) => r.json())
      .then((data) => {
        if (data.low !== undefined && data.medium !== undefined) {
          setThresholds(data);
        }
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
      <div className="mb-8">
        <span className="block font-mono tracking-[0.12em] mb-2 text-xs" style={{ color: "#a1a1aa" }}>
          POLICY &middot; SOROBAN CONTRACT
        </span>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#0f0f10" }}>
          Risk Policy
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>
          Current risk thresholds configured in the PolicyManager contract on Stellar Testnet
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12" style={{ color: "#a1a1aa" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading from Soroban...</span>
        </div>
      ) : thresholds ? (
        <div className="space-y-4">
          {/* Visual bar */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between font-mono" style={{ fontSize: "10px", color: "#a1a1aa" }}>
                <span>0</span>
                <span className="tracking-[0.12em]">RISK SCORE RANGE</span>
                <span>100</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden flex" style={{ backgroundColor: "#f7f7f8" }}>
                <div className="bg-emerald-500/50 transition-all duration-300 flex items-center justify-center" style={{ width: `${thresholds.low}%` }}>
                  <span className="text-[9px] font-mono font-bold text-emerald-700">ALLOW</span>
                </div>
                <div className="bg-amber-500/50 transition-all duration-300 flex items-center justify-center" style={{ width: `${thresholds.medium - thresholds.low}%` }}>
                  <span className="text-[9px] font-mono font-bold text-amber-700">WARN</span>
                </div>
                <div className="bg-red-500/50 transition-all duration-300 flex items-center justify-center" style={{ width: `${100 - thresholds.medium}%` }}>
                  <span className="text-[9px] font-mono font-bold text-red-700">BLOCK</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div
            className="rounded-2xl p-6"
            style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed" }}
          >
            <span className="block font-mono tracking-[0.12em] mb-4" style={{ fontSize: "10px", color: "#a1a1aa" }}>
              ACTIVE RULES
            </span>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <VerdictBadge verdict="ALLOW" />
                <span className="text-sm" style={{ color: "#166534" }}>
                  Score below <span className="font-mono font-bold">{thresholds.low}</span> — transaction is safe, auto-execute
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a" }}>
                <VerdictBadge verdict="WARN" />
                <span className="text-sm" style={{ color: "#854d0e" }}>
                  Score <span className="font-mono font-bold">{thresholds.low}</span> to <span className="font-mono font-bold">{thresholds.medium}</span> — needs human review before executing
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}>
                <VerdictBadge verdict="BLOCK" />
                <span className="text-sm" style={{ color: "#dc2626" }}>
                  Score above <span className="font-mono font-bold">{thresholds.medium}</span> — transaction blocked automatically
                </span>
              </div>
            </div>
          </div>

          {/* Contract info */}
          <div
            className="rounded-xl px-4 py-3 text-xs font-mono"
            style={{ backgroundColor: "#efefff", border: "1px solid #c7d2fe", color: "#52525b" }}
          >
            <span style={{ color: "#5b5cf6" }}>Contract: </span>
            CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6
            <span style={{ color: "#a1a1aa" }}> · stellar:testnet · owner-only updates</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-sm" style={{ color: "#a1a1aa" }}>
          Could not load policy from contract
        </div>
      )}
    </motion.div>
  );
}
