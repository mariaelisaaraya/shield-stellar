"use client";

import { useEnsName, useEnsAvatar } from "wagmi";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AgentIdentity({ address }: { address: string }) {
  const { data: ensName } = useEnsName({
    address: address as `0x${string}`,
    chainId: 1,
  });

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    chainId: 1,
  });

  if (ensName) {
    return (
      <span className="inline-flex items-center gap-2">
        {ensAvatar ? (
          <img
            src={ensAvatar}
            alt={ensName}
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <span
            className="w-5 h-5 rounded-full inline-block"
            style={{ backgroundColor: "#ebebed", border: "1px solid #d4d4d8" }}
          />
        )}
        <span style={{ color: "#5b5cf6" }}>{ensName}</span>
      </span>
    );
  }

  return <span>{shortAddr(address)}</span>;
}
