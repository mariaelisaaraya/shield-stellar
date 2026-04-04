"use client";

import { useEnsName, useEnsAvatar } from "wagmi";
import { formatAddress, getDisplayName } from "@/lib/ens";

interface AgentIdentityProps {
  address: string;
}

export function AgentIdentity({ address }: AgentIdentityProps) {
  const isValidAddress = address.startsWith("0x") && address.length === 42;

  const { data: ensName, isLoading: nameLoading } = useEnsName({
    address: isValidAddress ? (address as `0x${string}`) : undefined,
    chainId: 1,
  });

  const { data: ensAvatar, isLoading: avatarLoading } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
  });

  const displayName = getDisplayName(address, ensName);
  const isLoading = nameLoading || (ensName && avatarLoading);
  const initials = address.slice(2, 4).toUpperCase();

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {/* Avatar / Fallback circle */}
      {isLoading ? (
        <span
          className="shrink-0 rounded-full animate-pulse"
          style={{
            width: 22,
            height: 22,
            backgroundColor: "#ebebed",
          }}
        />
      ) : ensAvatar ? (
        <img
          src={ensAvatar}
          alt={displayName}
          className="shrink-0 rounded-full object-cover"
          style={{ width: 22, height: 22 }}
        />
      ) : (
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
      )}

      {/* Name / Address */}
      {isLoading ? (
        <span
          className="rounded animate-pulse"
          style={{
            width: 72,
            height: 14,
            backgroundColor: "#ebebed",
            display: "inline-block",
          }}
        />
      ) : ensName ? (
        <span
          className="truncate text-sm font-medium"
          style={{ color: "#0f0f10" }}
          title={address}
        >
          {ensName}
        </span>
      ) : (
        <span
          className="truncate text-sm font-mono"
          style={{ color: "#52525b" }}
          title={address}
        >
          {formatAddress(address)}
        </span>
      )}
    </span>
  );
}
