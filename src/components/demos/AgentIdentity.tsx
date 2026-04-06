"use client";

import { formatStellarAddress } from "@/lib/stellar";

interface AgentIdentityProps {
  address: string;
}

export function AgentIdentity({ address }: AgentIdentityProps) {
  const initials = address.slice(0, 2).toUpperCase();

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        className="shrink-0 rounded-full flex items-center justify-center font-mono"
        style={{
          width: 22,
          height: 22,
          backgroundColor: "#ebebed",
          color: "#a1a1aa",
          fontSize: "9px",
        }}
      >
        {initials}
      </span>
      <span
        className="truncate text-sm font-mono"
        style={{ color: "#52525b" }}
        title={address}
      >
        {formatStellarAddress(address)}
      </span>
    </span>
  );
}
