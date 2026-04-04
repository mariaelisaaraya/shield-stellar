"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Bot } from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { agentRegistryConfig } from "@/lib/contracts";

const inputClass =
  "flex h-9 w-full rounded-lg border px-3 py-1 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none";

const inputStyle = {
  backgroundColor: "#f7f7f8",
  borderColor: "#ebebed",
  color: "#0f0f10",
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
          className="block font-mono tracking-[0.12em] mb-2 text-xs"
          style={{ color: "#a1a1aa" }}
        >
          AGENTS &middot; HEDERA
        </span>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "#0f0f10" }}
        >
          Register Agent
        </h1>
      </div>

      {/* Form card */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "#ffffff", border: "1px solid #ebebed", borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.12em]"
              style={{ fontSize: "10px", color: "#a1a1aa" }}
            >
              AGENT ADDRESS
            </label>
            <input
              value={form.agent}
              placeholder={address || "0x..."}
              onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
            <p className="text-xs" style={{ color: "#a1a1aa" }}>
              Leave empty to use your connected wallet
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.12em]"
              style={{ fontSize: "10px", color: "#a1a1aa" }}
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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.12em]"
              style={{ fontSize: "10px", color: "#a1a1aa" }}
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
              className="flex min-h-[80px] w-full rounded-lg border px-3 py-2 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none resize-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
          </div>

          <div className="space-y-2">
            <label
              className="font-mono tracking-[0.12em]"
              style={{ fontSize: "10px", color: "#a1a1aa" }}
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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-10 w-full items-center justify-center gap-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#5b5cf6", borderRadius: "10px" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}
          >
            {isPending ? "Registering..." : "Register Agent"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
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
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
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
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}
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
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: "#f7f7f8", color: "#52525b", border: "1px solid #ebebed" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#efefff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f7f7f8")}
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
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
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
