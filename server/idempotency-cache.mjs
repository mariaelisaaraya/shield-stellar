// Minimal in-memory idempotency cache for x402 endpoints.
//
// Purpose: when a caller retries a request (e.g. because the network
// dropped the original response after payment was settled), an
// Idempotency-Key header lets them declare "this is the same logical
// request I sent before — if you already computed an answer, give me
// that one instead of redoing the work".
//
// x402 best practices (see https://www.x402.org/) call this out
// explicitly. For ShieldStellar it prevents redundant Soroban RPC
// round trips and, more importantly, keeps the response stable so
// agents that retry don't see a different verdict on the second try
// because, say, the PolicyManager thresholds were updated in between.
//
// This is a zero-dependency implementation. It's a Map keyed by the
// Idempotency-Key header value, with per-entry TTL and LRU eviction
// when the max entry count is reached. Good enough for a single
// Node process; when ShieldStellar scales horizontally, swap this
// for Redis behind the same interface.
//
// The cache stores the *stringified* request body alongside the
// response so it can enforce the Stripe/GitHub convention: reusing
// a key with different inputs is a client bug and returns 409
// Conflict rather than silently returning the stale answer.

/**
 * @typedef {object} CacheEntry
 * @property {string} bodyStr     Stringified, normalized request body.
 * @property {number} statusCode  HTTP status code to replay.
 * @property {object} responseBody The JSON response body to replay.
 * @property {number} expiresAt   Epoch ms after which the entry is stale.
 */

/**
 * Build an idempotency cache.
 *
 * @param {object} [options]
 * @param {number} [options.ttlMs=300000]    Entry lifetime (default 5 min).
 * @param {number} [options.maxEntries=1000] Max entries before LRU eviction.
 * @param {() => number} [options.now]       Clock source, overridable in tests.
 */
export function createIdempotencyCache({
  ttlMs = 5 * 60 * 1000,
  maxEntries = 1000,
  now = Date.now,
} = {}) {
  /** @type {Map<string, CacheEntry>} */
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      store.delete(key);
      return undefined;
    }
    // Touch: move to the end of the Map so it's the most-recently-used.
    store.delete(key);
    store.set(key, entry);
    return entry;
  }

  function set(key, { bodyStr, statusCode, responseBody }) {
    // Evict the oldest entry first if we're at capacity. Map iteration
    // order is insertion order, so the first key is the oldest.
    while (store.size >= maxEntries) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
    store.set(key, {
      bodyStr,
      statusCode,
      responseBody,
      expiresAt: now() + ttlMs,
    });
  }

  function size() {
    return store.size;
  }

  function clear() {
    store.clear();
  }

  return { get, set, size, clear };
}

/**
 * Normalize a request body to a stable string for cache comparison.
 * Only the fields that influence the computed verdict are included —
 * other fields (accidental extras) don't invalidate the cache.
 *
 * @param {object} body
 * @returns {string}
 */
export function normalizeVerdictBody(body) {
  const normalized = {
    target: body?.target ?? null,
    amountUsd: body?.amountUsd ?? null,
    action: body?.action ?? null,
    isNewTarget: body?.isNewTarget ?? true,
  };
  return JSON.stringify(normalized);
}
