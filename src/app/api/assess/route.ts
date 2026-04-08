import { NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
import { CONTRACTS, DEPLOYER } from "@/lib/contracts-stellar";
import { submitContractCall } from "../soroban-write";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agent, target, riskScore, verdict, reason } = body;

    if (!agent || !target || riskScore === undefined || !verdict || !reason) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const args = [
      StellarSdk.nativeToScVal(agent, { type: "address" }),
      StellarSdk.nativeToScVal(target, { type: "address" }),
      StellarSdk.nativeToScVal(riskScore, { type: "u32" }),
      StellarSdk.nativeToScVal(verdict, { type: "string" }),
      StellarSdk.nativeToScVal(reason, { type: "string" }),
    ];

    const { txHash, success } = await submitContractCall(
      CONTRACTS.assessmentRegistry,
      "create_assessment",
      args
    );

    return NextResponse.json({
      txHash,
      success,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Assessment failed";
    console.error("assess error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
