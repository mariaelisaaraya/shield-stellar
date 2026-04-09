// Known-risky Stellar addresses used by the risk scoring engine.
// Mirror of server/data/risky-addresses.mjs so the Next.js API route
// and the Express x402 server share the same list. Keep these in sync.
//
// When adding a new entry, include a short note explaining why.
export const RISKY_ADDRESSES: readonly string[] = [
  // Demo burn-like address (all zeros suffix WHF) — used by /cre-simulate fixtures
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  // Demo burn-like address (all zeros suffix DST) — used by /cre-simulate fixtures
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADST",
];

export function isRiskyAddress(address: string): boolean {
  return RISKY_ADDRESSES.includes(address);
}
