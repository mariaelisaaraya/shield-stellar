"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Bot } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { agentRegistryConfig } from "@/lib/contracts";

const inputClass =
  "flex h-9 w-full rounded-md border px-3 py-1 font-mono text-sm shadow-sm transition-colors placeholder:text-[#444] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2563EB]/50";

const inputStyle = {
  backgroundColor: "#0a0a0a",
  borderColor: "#1a1a1a",
  color: "#e0e0e0",
};

export default function AgentsPage() {
  const { address, isConnected } = useAccount();
  const { data: hash, writeContract, isPending, isSuccess, error: writeError, reset: resetWrite } = useWriteContract();

  const [form, setForm] = useState({
    agent: "",
    name: "",
    description: "",
    metadataURI: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [walletWarning, setWalletWarning] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setForm({ agent: "", name: "", description: "", metadataURI: "" });
    }
  }, [isSuccess]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    resetWrite();
    setWalletWarning(false);

    if (!isConnected || !address) {
      setWalletWarning(true);
      return;
    }

    const agentAddr = (form.agent || address) as `0x${string}`;

    writeContract({
      ...agentRegistryConfig,
      functionName: "registerAgent",
      args: [agentAddr, form.metadataURI],
    }, {
      onError: (err) => setError(err.message?.split("\n")[0] || "Transaction failed"),
    });
  }

  function handleReset() {
    resetWrite();
    setError(null);
    setForm({ agent: "", name: "", description: "", metadataURI: "" });
  }

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
          AGENTS &middot; HEDERA
        </span>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "#f0f0f0" }}
        >
          Register Agent
        </h1>
      </div>

      {/* Form card */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "#0f0f0f", border: "1px solid #1a1a1a" }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.06em]"
              style={{ fontSize: "11px", color: "#444" }}
            >
              AGENT ADDRESS
            </label>
            <input
              value={form.agent}
              placeholder={address || "0x..."}
              onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: "#444" }}>
              Leave empty to use your connected wallet
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.06em]"
              style={{ fontSize: "11px", color: "#444" }}
            >
              AGENT NAME
            </label>
            <input
              placeholder="e.g. PaymentBot-v2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.06em]"
              style={{ fontSize: "11px", color: "#444" }}
            >
              DESCRIPTION
            </label>
            <textarea
              placeholder="What does this agent do?"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              required
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border px-3 py-2 font-mono text-sm shadow-sm transition-colors placeholder:text-[#444] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2563EB]/50 resize-none"
              style={inputStyle}
            />
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.06em]"
              style={{ fontSize: "11px", color: "#444" }}
            >
              METADATA URI
            </label>
            <input
              placeholder="ipfs://Qm... or https://..."
              value={form.metadataURI}
              onChange={(e) =>
                setForm((f) => ({ ...f, metadataURI: e.target.value }))
              }
              required
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#2563EB" }}
          >
            {isPending ? "Registering..." : "Register Agent"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Wallet warning */}
      <AnimatePresence>
        {walletWarning && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400"
          >
            Please connect your wallet
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success banner */}
      <AnimatePresence>
        {isSuccess && hash && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Agent registered on Hedera ✓ tx: {hash.slice(0, 6)}...{hash.slice(-4)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Register another */}
      <AnimatePresence>
        {isSuccess && hash && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4"
          >
            <button
              onClick={handleReset}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1a1a1a", color: "#888", border: "1px solid #333" }}
            >
              <Bot className="w-4 h-4" />Register Another Agent
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {writeError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400"
          >
            {writeError.message.length > 120
              ? writeError.message.slice(0, 120) + "..."
              : writeError.message}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
