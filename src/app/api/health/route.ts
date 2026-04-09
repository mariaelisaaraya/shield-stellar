import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

const PROBE_TIMEOUT_MS = 3000;

// GET /api/health
//
// Lightweight liveness + dependency check for the Render deploy.
// Returns 200 when the unified server is up and Soroban RPC is
// reachable, 503 otherwise.
//
// Render configures this as its healthcheck so an outage of Stellar
// testnet surfaces as a failed health status instead of the dashboard
// quietly falling back to zeros and stale thresholds.
//
// We use Soroban RPC's canonical `getHealth` JSON-RPC method
// (https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth)
// rather than going through src/app/api/rpc.ts — that module wraps
// every call in a catch that falls back to safe defaults so the UI
// keeps rendering, which is the right call for the dashboard but
// useless for a healthcheck (it would never return an error).
export async function GET() {
  const start = Date.now();

  try {
    const response = await fetch(SOROBAN_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Soroban RPC returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const status = data?.result?.status;

    if (status !== "healthy") {
      throw new Error(
        `Soroban RPC getHealth returned status="${status ?? "unknown"}"`,
      );
    }

    return NextResponse.json({
      ok: true,
      sorobanRpc: "healthy",
      url: SOROBAN_RPC_URL,
      elapsedMs: Date.now() - start,
    });
  } catch (err) {
    console.error("[health] probe failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        sorobanRpc: "unreachable",
        url: SOROBAN_RPC_URL,
        error: message,
        elapsedMs: Date.now() - start,
      },
      { status: 503 },
    );
  }
}
