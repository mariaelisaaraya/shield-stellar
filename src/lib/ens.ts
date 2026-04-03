/**
 * ENS resolution utilities.
 * Pure helper functions — wagmi hooks live in components.
 */

/** Abbreviate an Ethereum address: "0x742d...f1A2" */
export function formatAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Return ENS name when available, otherwise abbreviated address. */
export function getDisplayName(
  address: string,
  ensName: string | null | undefined,
): string {
  return ensName ?? formatAddress(address);
}
