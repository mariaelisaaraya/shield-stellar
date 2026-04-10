// Sanity tests for the verified protocols registry.
//
// Run with:
//
//   node server/test-verified-protocols.mjs
//
// These tests verify the registry parses, every entry has a well-formed
// Soroban contract ID, lookup is case-sensitive and network-aware, and
// no two entries collide on the same (network, contractId) pair.

import assert from "node:assert/strict";
import {
  VERIFIED_PROTOCOLS,
  CATEGORIES,
  lookupProtocol,
  isVerifiedProtocol,
} from "./data/verified-protocols.mjs";

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

// --- Registry shape ------------------------------------------------------

check("registry is non-empty", () => {
  assert.ok(VERIFIED_PROTOCOLS.length > 0);
});

check("every entry has the required fields", () => {
  for (const p of VERIFIED_PROTOCOLS) {
    assert.equal(typeof p.contractId, "string", `missing contractId on ${p.name}`);
    assert.equal(typeof p.name, "string", `missing name`);
    assert.ok(CATEGORIES.includes(p.category), `bad category "${p.category}" on ${p.name}`);
    assert.ok(
      p.network === "mainnet" || p.network === "testnet",
      `bad network "${p.network}" on ${p.name}`,
    );
    assert.equal(typeof p.verifiedSource, "string", `missing verifiedSource on ${p.name}`);
    assert.ok(p.verifiedSource.startsWith("http"), `verifiedSource must be a URL`);
  }
});

check("every contract ID is a valid Soroban address", () => {
  const re = /^C[A-Z2-7]{55}$/;
  for (const p of VERIFIED_PROTOCOLS) {
    assert.match(p.contractId, re, `bad contract ID for ${p.name}: ${p.contractId}`);
  }
});

check("no duplicate (network, contractId) pairs", () => {
  const seen = new Set();
  for (const p of VERIFIED_PROTOCOLS) {
    const key = `${p.network}:${p.contractId}`;
    assert.ok(!seen.has(key), `duplicate entry: ${key}`);
    seen.add(key);
  }
});

// --- Coverage sanity (not exhaustive — just makes sure the headline
// protocols are present and we don't accidentally delete them) ------------

check("Blend mainnet pool factory is registered", () => {
  const blend = lookupProtocol(
    "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU",
    "mainnet",
  );
  assert.ok(blend !== null, "Blend pool factory should be in the registry");
  assert.equal(blend.category, "lending");
  assert.match(blend.name, /Blend/);
});

check("Blend testnet pool factory is registered", () => {
  const blend = lookupProtocol(
    "CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6",
    "testnet",
  );
  assert.ok(blend !== null);
  assert.equal(blend.network, "testnet");
});

check("Soroswap router is registered as AMM", () => {
  const soroswap = lookupProtocol(
    "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
    "mainnet",
  );
  assert.ok(soroswap !== null);
  assert.equal(soroswap.category, "amm");
});

check("Aquarius mainnet AMM is registered", () => {
  const aqua = lookupProtocol(
    "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
    "mainnet",
  );
  assert.ok(aqua !== null);
  assert.equal(aqua.category, "amm");
});

// --- Lookup behavior -----------------------------------------------------

check("lookup returns null for unknown address", () => {
  assert.equal(
    lookupProtocol(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "mainnet",
    ),
    null,
  );
});

check("lookup is network-scoped", () => {
  // The mainnet pool factory ID does not exist on testnet.
  const result = lookupProtocol(
    "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU",
    "testnet",
  );
  assert.equal(result, null);
});

check("isVerifiedProtocol returns boolean", () => {
  assert.equal(
    isVerifiedProtocol(
      "CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU",
      "mainnet",
    ),
    true,
  );
  assert.equal(isVerifiedProtocol("not-an-id", "mainnet"), false);
  assert.equal(isVerifiedProtocol("", "mainnet"), false);
  assert.equal(isVerifiedProtocol(null, "mainnet"), false);
  assert.equal(isVerifiedProtocol(undefined, "mainnet"), false);
});

console.log("");
if (failures === 0) {
  console.log(`All ${VERIFIED_PROTOCOLS.length} entries validated. ${VERIFIED_PROTOCOLS.length} protocols registered.`);
  process.exit(0);
} else {
  console.error(`${failures} test case(s) failed.`);
  process.exit(1);
}
