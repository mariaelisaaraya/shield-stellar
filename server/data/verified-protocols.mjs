// Registry of verified Stellar / Soroban DeFi protocol contract addresses.
//
// Purpose: when ShieldStellar's risk scoring engine sees a target address
// in this list, it knows the target is a published contract from a known
// protocol — not a random unknown account. Two scoring effects:
//
//   1. The "new target" penalty (+15) is suppressed, because the target is
//      a verified protocol with public docs and an audit trail rather than
//      a counterparty the agent has never seen.
//   2. The `reasons` array gets enriched with human-readable context
//      ("target is the Blend V2 Pool Factory on Stellar mainnet — lending,
//      published address from blend.capital docs"), so the verdict is
//      legible to the operator reviewing it.
//
// What this list is *not*:
//
//   - It is NOT an allowlist. A verified protocol target can still earn a
//     BLOCK verdict if the amount or action is risky enough.
//   - It is NOT a security audit. The fact that a protocol is here means
//     "the addresses are real and published by the team", not "the code is
//     safe".
//   - It is NOT exhaustive. The Stellar DeFi ecosystem keeps growing.
//     New entries should arrive with a `verifiedSource` URL pointing to
//     where the address was originally published.
//
// Adding a new protocol:
//
//   1. Find the contract ID(s) on the protocol's *official* docs or repo
//      (never from a third-party indexer alone).
//   2. Pick the most narrow, specific category from CATEGORIES below.
//   3. Set network to "mainnet" or "testnet" — never both. Add separate
//      entries if a protocol is on both.
//   4. Set verifiedSource to the URL where you read the address.
//
// Stellar contract IDs are 56-character base32 strings starting with `C`.
// We validate the format at module load time so a typo crashes early.

export const CATEGORIES = /** @type {const} */ ([
  "lending",
  "dex",
  "amm",
  "stablecoin",
  "rwa",
  "perps",
  "yield-aggregator",
  "bridge",
  "token",
  "infrastructure",
]);

/**
 * @typedef {object} VerifiedProtocol
 * @property {string} contractId      Soroban contract ID (56-char, starts with C).
 * @property {string} name            Display name shown in scoring reasons.
 * @property {typeof CATEGORIES[number]} category
 * @property {"mainnet" | "testnet"} network
 * @property {string} verifiedSource  URL where the address was published.
 * @property {string} [notes]         Optional context surfaced in reasons.
 */

/** @type {VerifiedProtocol[]} */
export const VERIFIED_PROTOCOLS = [
  // ─── Blend V2 — mainnet ────────────────────────────────────────────
  // Lending protocol primitive on Soroban; ~$80M TVL as of early 2026
  // per the Stellar DeFi ecosystem report.
  // Source: https://docs.blend.capital/mainnet-deployments
  {
    contractId: "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU",
    name: "Blend V2 Pool Factory",
    category: "lending",
    network: "mainnet",
    verifiedSource: "https://docs.blend.capital/mainnet-deployments",
    notes: "Factory that deploys isolated lending pools. Most user-facing pool addresses descend from this factory.",
  },
  {
    contractId: "CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7",
    name: "Blend V2 Backstop",
    category: "lending",
    network: "mainnet",
    verifiedSource: "https://docs.blend.capital/mainnet-deployments",
    notes: "Insurance backstop for Blend pools.",
  },
  {
    contractId: "CCOQM6S7ICIUWA225O5PSJWUBEMXGFSSW2PQFO6FP4DQEKMS5DASRGRR",
    name: "Blend Emitter",
    category: "lending",
    network: "mainnet",
    verifiedSource: "https://docs.blend.capital/mainnet-deployments",
    notes: "Emits BLND token rewards to backstop depositors.",
  },
  {
    contractId: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    name: "BLND Token (Soroban)",
    category: "token",
    network: "mainnet",
    verifiedSource: "https://docs.blend.capital/mainnet-deployments",
  },
  {
    contractId: "CAS3FL6TLZKDGGSISDBWGGPXT3NRR4DYTZD7YOD3HMYO6LTJUVGRVEAM",
    name: "Comet BLND:USDC Liquidity Pool",
    category: "amm",
    network: "mainnet",
    verifiedSource: "https://docs.blend.capital/mainnet-deployments",
    notes: "Comet weighted-pool used for the BLND:USDC liquidity pair.",
  },

  // ─── Blend V2 — testnet ────────────────────────────────────────────
  // Source: https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json
  // Stellar testnet resets periodically — re-verify before relying on
  // these for end-to-end tests in CI.
  {
    contractId: "CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6",
    name: "Blend V2 Pool Factory (testnet)",
    category: "lending",
    network: "testnet",
    verifiedSource: "https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json",
  },
  {
    contractId: "CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA",
    name: "Blend V2 Backstop (testnet)",
    category: "lending",
    network: "testnet",
    verifiedSource: "https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json",
  },
  {
    contractId: "CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6",
    name: "Blend Emitter (testnet)",
    category: "lending",
    network: "testnet",
    verifiedSource: "https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json",
  },
  {
    contractId: "CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF",
    name: "BLND Token (testnet)",
    category: "token",
    network: "testnet",
    verifiedSource: "https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json",
  },
  {
    contractId: "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU",
    name: "USDC (testnet — Blend deployment)",
    category: "stablecoin",
    network: "testnet",
    verifiedSource: "https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json",
    notes: "USDC SAC referenced in Blend's testnet deployment manifest.",
  },

  // ─── Soroswap — mainnet ────────────────────────────────────────────
  // Open-source AMM on Soroban modeled on Uniswap v2.
  // NOTE: published addresses sourced from a single search result;
  // re-verify against docs.soroswap.finance before treating as
  // authoritative for high-value flows.
  {
    contractId: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
    name: "Soroswap Factory",
    category: "amm",
    network: "mainnet",
    verifiedSource: "https://docs.soroswap.finance/01-protocol-overview/03-technical-reference/03-smart-contracts",
    notes: "Pair factory for Soroswap pools.",
  },
  {
    contractId: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
    name: "Soroswap Router",
    category: "amm",
    network: "mainnet",
    verifiedSource: "https://docs.soroswap.finance/01-protocol-overview/03-technical-reference/03-smart-contracts",
    notes: "User-facing router for swaps and liquidity actions.",
  },

  // ─── Aquarius AMM — mainnet ────────────────────────────────────────
  // Decentralized exchange and liquidity hub; ~$40M TVL early 2026.
  // Source: Aquarius docs (developer pages).
  {
    contractId: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
    name: "Aquarius AMM Router",
    category: "amm",
    network: "mainnet",
    verifiedSource: "https://docs.aqua.network/developers/code-examples/prerequisites-and-basics",
  },
];

// --- Validation: catch typos at module load instead of at runtime --------
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;
for (const protocol of VERIFIED_PROTOCOLS) {
  if (!CONTRACT_ID_RE.test(protocol.contractId)) {
    throw new Error(
      `verified-protocols: invalid Soroban contract ID for "${protocol.name}": ` +
      `"${protocol.contractId}" (must be 56 chars starting with C)`,
    );
  }
  if (!CATEGORIES.includes(protocol.category)) {
    throw new Error(
      `verified-protocols: unknown category "${protocol.category}" for "${protocol.name}"`,
    );
  }
  if (protocol.network !== "mainnet" && protocol.network !== "testnet") {
    throw new Error(
      `verified-protocols: invalid network "${protocol.network}" for "${protocol.name}"`,
    );
  }
  if (!protocol.verifiedSource) {
    throw new Error(
      `verified-protocols: missing verifiedSource for "${protocol.name}"`,
    );
  }
}

// --- Indexes for fast lookup ---------------------------------------------
// Built once at module load; both lookup directions are O(1).

const BY_ADDRESS = new Map(
  VERIFIED_PROTOCOLS.map((p) => [`${p.network}:${p.contractId}`, p]),
);

/**
 * Find a verified protocol entry by contract ID and network.
 *
 * @param {string} contractId
 * @param {"mainnet" | "testnet"} network
 * @returns {VerifiedProtocol | null}
 */
export function lookupProtocol(contractId, network) {
  if (typeof contractId !== "string" || !contractId) return null;
  return BY_ADDRESS.get(`${network}:${contractId}`) ?? null;
}

/**
 * Convenience: returns true if `contractId` is a known protocol on `network`.
 *
 * @param {string} contractId
 * @param {"mainnet" | "testnet"} network
 * @returns {boolean}
 */
export function isVerifiedProtocol(contractId, network) {
  return lookupProtocol(contractId, network) !== null;
}
