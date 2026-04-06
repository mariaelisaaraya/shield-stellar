"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Bot } from "lucide-react";
import { useStellarWallet } from "@/components/providers";

const inputClass =
  "flex h-9 w-full rounded-lg border px-3 py-1 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none";

const inputStyle = {
  backgroundColor: "#f7f7f8",
  borderColor: "#ebebed",
  color: "#0f0f10",
};

export default function AgentsPage() {
  const { publicKey, isConnected, connect } = useStellarWallet();

  const [form, setForm] = useState({
    agent: "",
    name: "",
    description: "",
    metadataURI: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [walletWarning, setWalletWarning] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);
    setWalletWarning(false);

    if (!isConnected || !publicKey) {
      setWalletWarning(true);
      return;
    }

    setIsPending(true);
    try {
      // TODO: Replace with Soroban contract call after deploy
      const agentAddr = form.agent || publicKey;
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to register agent");
      setIsSuccess(true);
      setForm({ agent: "", name: "", description: "", metadataURI: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsPending(false);
    }
  }

  function handleReset() {
    setIsSuccess(false);
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
          AGENTS &middot; STELLAR
        </span>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "#0f0f10" }}
        >
          Register Agent
        </h1>
        <p style={{ color: "var(--text-3)", fontSize: "14px", marginTop: "4px" }}>
          Register an AI agent identity on Stellar via Soroban contract
        </p>
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
              placeholder={publicKey || "G..."}
              onChange={(e) => setForm((f) => ({ ...f, agent: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
            <p className="text-xs" style={{ color: "#a1a1aa" }}>
              Leave empty to use your connected Freighter wallet
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>
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
            <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>
              DESCRIPTION
            </label>
            <textarea
              placeholder="What does this agent do?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              rows={3}
              className="flex min-h-[80px] w-full rounded-lg border px-3 py-2 font-mono text-sm transition-colors placeholder:text-[#a1a1aa] focus:outline-none resize-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5b5cf6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ebebed")}
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono tracking-[0.12em]" style={{ fontSize: "10px", color: "#a1a1aa" }}>
              METADATA URI
            </label>
            <input
              placeholder="ipfs://Qm... or https://..."
              value={form.metadataURI}
              onChange={(e) => setForm((f) => ({ ...f, metadataURI: e.target.value }))}
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

      <AnimatePresence>
        {walletWarning && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
          >
            Please connect your Freighter wallet
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Agent registered on Stellar
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSuccess && (
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
    </motion.div>
  );
}
