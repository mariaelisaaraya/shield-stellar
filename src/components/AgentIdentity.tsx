"use client";

import { formatStellarAddress } from "@/lib/stellar";

export function AgentIdentity({ address }: { address: string }) {
  const initials = address.slice(0, 2).toUpperCase();

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="w-5 h-5 rounded-full inline-flex items-center justify-center font-mono"
        style={{ backgroundColor: "#ebebed", color: "#a1a1aa", fontSize: "9px" }}
      >
        {initials}
      </span>
      <span className="font-mono text-sm" style={{ color: "#52525b" }}>
        {formatStellarAddress(address)}
      </span>
    </span>
  );
}
