// Known-risky Stellar addresses used by the risk scoring engine.
// Data is kept separate from logic so it can be audited and expanded
// without touching scoring code.
//
// Sources:
//   - Null/burn-like addresses historically seen on Stellar testnet
//   - Internal demo addresses flagged for integration testing
//
// When adding a new entry, include a short note explaining why.
export const RISKY_ADDRESSES = [
  // Demo burn-like address (all zeros suffix WHF) — used by /cre-simulate fixtures
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  // Demo burn-like address (all zeros suffix DST) — used by /cre-simulate fixtures
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADST",
];

export function isRiskyAddress(address) {
  return RISKY_ADDRESSES.includes(address);
}
