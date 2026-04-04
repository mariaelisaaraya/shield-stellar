import { NextResponse } from "next/server";
import { getAgentCount, getTotalAssessments, getRecentAssessments } from "../rpc";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [agentCount, total, recent] = await Promise.all([
      getAgentCount(),
      getTotalAssessments(),
      getRecentAssessments(50),
    ]);

    const blocked = recent.filter((a) => a.verdict === "BLOCK").length;
    const avgScore = recent.length > 0
      ? Math.round(recent.reduce((sum, a) => sum + a.riskScore, 0) / recent.length)
      : 0;

    return NextResponse.json({ agentCount, total, blocked, avgScore, recent });
  } catch (e: any) {
    return NextResponse.json({ agentCount: 0, total: 0, blocked: 0, avgScore: 0, recent: [] });
  }
}
