import { NextResponse } from "next/server";
import { getVerdict } from "../rpc";
import {
  computeRiskScore,
  validateScoringInputs,
  type RiskAction,
} from "@/lib/risk-scoring";

export const dynamic = "force-dynamic";

// POST /api/verdict
// Body: { target: string, amountUsd: number, action: RiskAction, isNewTarget?: boolean }
//
// The risk score is computed server-side from the inputs and then
// evaluated against the on-chain PolicyManager thresholds. Callers
// cannot pass a pre-computed `score` — that would defeat the point.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "request body must be valid JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  if (payload.score !== undefined) {
    return NextResponse.json(
      {
        error:
          "score is no longer accepted from callers — it is computed server-side from { target, amountUsd, action }",
      },
      { status: 400 },
    );
  }

  const validationError = validateScoringInputs({
    target: payload.target,
    amountUsd: payload.amountUsd,
    action: payload.action,
  });
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const target = payload.target as string;
  const amountUsd = payload.amountUsd as number;
  const action = payload.action as RiskAction;
  const isNewTarget =
    typeof payload.isNewTarget === "boolean" ? payload.isNewTarget : true;

  const { score, reasons } = computeRiskScore({ target, amountUsd, action, isNewTarget });

  try {
    const verdict = await getVerdict(score);
    console.log(
      `[verdict] target=${target} amountUsd=${amountUsd} action=${action} ` +
        `→ score=${score} verdict=${verdict}`,
    );
    return NextResponse.json({
      verdict,
      score,
      reasons,
      inputs: { target, amountUsd, action, isNewTarget },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
