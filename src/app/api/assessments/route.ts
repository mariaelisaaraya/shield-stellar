import { NextResponse } from "next/server";
import { getTotalAssessments, getAssessment } from "../rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const total = await getTotalAssessments();
    if (total === 0) return NextResponse.json({ assessments: [] });

    const count = Math.min(total, 5);
    const ids = [];
    for (let i = total - 1; i >= total - count; i--) ids.push(i);

    const results = await Promise.all(
      ids.map((id) =>
        getAssessment(id).catch((err) => {
          // Log per-assessment failures so a systematic schema/contract
          // problem is visible, not silently turned into a shorter list.
          console.warn(`[assessments] skipped id=${id}:`, err);
          return null;
        }),
      ),
    );
    const assessments = results.filter((a) => a !== null);

    return NextResponse.json({ assessments });
  } catch (err) {
    // Total-fetch failures shouldn't kill the dashboard, but they
    // also shouldn't vanish. Log before returning the empty fallback.
    console.error("[assessments] falling back to empty list:", err);
    return NextResponse.json({ assessments: [] });
  }
}
