import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hederaTestnet as viemHederaTestnet } from "viem/chains";

// ---------- env validation ----------
const NETWORK = process.env.NETWORK || "local";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
const TARGET_ADDRESS = process.env.TARGET_ADDRESS as Hex | undefined;
const HEDERA_ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const TARGET_ACCOUNT_ID = process.env.TARGET_ACCOUNT_ID;

const AGENT_REGISTRY = process.env.AGENT_REGISTRY_ADDRESS as Hex | undefined;
const ASSESSMENT_REGISTRY = process.env.ASSESSMENT_REGISTRY_ADDRESS as Hex | undefined;
const POLICY_MANAGER = process.env.POLICY_MANAGER_ADDRESS as Hex | undefined;

function requireEnv(name: string, value: unknown): asserts value is string {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

// ---------- risk scoring ----------
const RISKY_PATTERNS = ["dead", "0000000000000000000000000000000000000000"];
const ACTION_RISK: Record<string, number> = {
  transfer: 0,
  swap: 10,
  "contract-call": 15,
  mint: 10,
  other: 5,
};

function computeRiskScore(
  target: string,
  amount: number,
  action: string,
): number {
  let score = 0;
  const addr = target.toLowerCase();
  if (RISKY_PATTERNS.some((p) => addr.includes(p))) score += 60;
  if (amount > 100) score += 35;
  else if (amount > 10) score += 20;
  else if (amount > 1) score += 10;
  else score += 5;
  score += ACTION_RISK[action] || 5;
  score += 10;
  return Math.max(0, Math.min(score, 100));
}

// ---------- contract ABIs ----------
const agentRegistryAbi = parseAbi([
  "function registerAgent(address agent, string metadataURI) external",
  "function getAgentCount() view returns (uint256)",
]);

const assessmentRegistryAbi = parseAbi([
  "function createAssessment(address agent, address target, uint256 riskScore, string verdict, string reason) external",
  "function getTotalAssessments() view returns (uint256)",
]);

const policyManagerAbi = parseAbi([
  "function getThresholds() view returns (uint256 low, uint256 medium)",
  "function evaluateScore(uint256 score) view returns (string)",
]);

// ============================================================
//  LOCAL MODE — viem + Anvil / Hedera JSON-RPC
// ============================================================
async function runLocal() {
  requireEnv("AGENT_PRIVATE_KEY", AGENT_PRIVATE_KEY);
  requireEnv("TARGET_ADDRESS", TARGET_ADDRESS);
  requireEnv("AGENT_REGISTRY_ADDRESS", AGENT_REGISTRY);
  requireEnv("ASSESSMENT_REGISTRY_ADDRESS", ASSESSMENT_REGISTRY);
  requireEnv("POLICY_MANAGER_ADDRESS", POLICY_MANAGER);

  const account = privateKeyToAccount(AGENT_PRIVATE_KEY!);
  const chain = viemHederaTestnet;
  const transport = http(process.env.RPC_URL || "https://testnet.hashio.io/api");

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  console.log("\n=== AegisPay Agent (LOCAL mode) ===");
  console.log("Agent address:", account.address);
  console.log("Target address:", TARGET_ADDRESS);

  // 1. Register agent
  console.log("\n--- Step 1: Register Agent ---");
  try {
    const hash = await walletClient.writeContract({
      address: AGENT_REGISTRY!,
      abi: agentRegistryAbi,
      functionName: "registerAgent",
      args: [account.address, "ipfs://agent-metadata"],
    });
    console.log("Register tx:", hash);
  } catch (e: any) {
    console.log("Register agent:", e.shortMessage || e.message);
  }

  // 2. Read agent count
  const agentCount = await publicClient.readContract({
    address: AGENT_REGISTRY!,
    abi: agentRegistryAbi,
    functionName: "getAgentCount",
  });
  console.log("Total agents:", agentCount.toString());

  // 3. Compute risk & get verdict
  console.log("\n--- Step 2: Assess Risk ---");
  const amount = 50;
  const action = "transfer";
  const riskScore = computeRiskScore(TARGET_ADDRESS!, amount, action);
  console.log(`Risk score for ${amount} HBAR ${action}: ${riskScore}`);

  const verdict = await publicClient.readContract({
    address: POLICY_MANAGER!,
    abi: policyManagerAbi,
    functionName: "evaluateScore",
    args: [BigInt(riskScore)],
  });
  console.log("Verdict:", verdict);

  // 4. Register assessment
  console.log("\n--- Step 3: Register Assessment ---");
  try {
    const hash = await walletClient.writeContract({
      address: ASSESSMENT_REGISTRY!,
      abi: assessmentRegistryAbi,
      functionName: "createAssessment",
      args: [
        account.address,
        TARGET_ADDRESS!,
        BigInt(riskScore),
        verdict,
        `${action} of ${amount} HBAR`,
      ],
    });
    console.log("Assessment tx:", hash);
  } catch (e: any) {
    console.log("Register assessment:", e.shortMessage || e.message);
  }

  // 5. Read total assessments
  const total = await publicClient.readContract({
    address: ASSESSMENT_REGISTRY!,
    abi: assessmentRegistryAbi,
    functionName: "getTotalAssessments",
  });
  console.log("Total assessments:", total.toString());

  console.log("\n=== Agent mission complete ===\n");
}

// ============================================================
//  HEDERA MODE — Hedera Agent Kit
// ============================================================
async function runHedera() {
  requireEnv("AGENT_PRIVATE_KEY", AGENT_PRIVATE_KEY);
  requireEnv("HEDERA_ACCOUNT_ID", HEDERA_ACCOUNT_ID);
  requireEnv("TARGET_ACCOUNT_ID", TARGET_ACCOUNT_ID);
  requireEnv("TARGET_ADDRESS", TARGET_ADDRESS);
  requireEnv("ASSESSMENT_REGISTRY_ADDRESS", ASSESSMENT_REGISTRY);
  requireEnv("POLICY_MANAGER_ADDRESS", POLICY_MANAGER);

  // Dynamic imports for Hedera-specific modules
  const { HederaAgentKit } = await import("hedera-agent-kit");
  const {
    ContractCallQuery,
    ContractExecuteTransaction,
    ContractFunctionParameters,
    Hbar,
  } = await import("@hashgraph/sdk");

  const kit = new HederaAgentKit(
    HEDERA_ACCOUNT_ID!,
    AGENT_PRIVATE_KEY!.replace(/^0x/, ""),
    "testnet",
  );

  console.log("\n=== AegisPay Agent (HEDERA mode) ===");
  console.log("Operator:", HEDERA_ACCOUNT_ID);
  console.log("Target:", TARGET_ACCOUNT_ID);

  // 1. Transfer HBAR
  console.log("\n--- Step 1: Transfer HBAR ---");
  const transferAmount = 1;
  try {
    const result = await kit.transferHbar(
      TARGET_ACCOUNT_ID!,
      transferAmount,
    );
    console.log("Transfer result:", result);
  } catch (e: any) {
    console.log("Transfer:", e.message);
  }

  // 2. Compute risk & read verdict from PolicyManager
  console.log("\n--- Step 2: Assess Risk ---");
  const riskScore = computeRiskScore(TARGET_ADDRESS!, transferAmount, "transfer");
  console.log(`Risk score: ${riskScore}`);

  // Convert EVM address to Solidity contract ID for Hedera SDK
  const policyContractId = POLICY_MANAGER!;
  try {
    const query = new ContractCallQuery()
      .setContractId(policyContractId)
      .setGas(100_000)
      .setFunction(
        "evaluateScore",
        new ContractFunctionParameters().addUint256(riskScore),
      );

    const response = await query.execute(kit.client);
    const verdict = response.getString(0);
    console.log("Verdict:", verdict);

    // 3. Register assessment on-chain
    console.log("\n--- Step 3: Register Assessment ---");
    const assessmentContractId = ASSESSMENT_REGISTRY!;
    const tx = new ContractExecuteTransaction()
      .setContractId(assessmentContractId)
      .setGas(300_000)
      .setFunction(
        "createAssessment",
        new ContractFunctionParameters()
          .addAddress(kit.operatorAccountId.toSolidityAddress())
          .addAddress(TARGET_ADDRESS!.replace(/^0x/, ""))
          .addUint256(riskScore)
          .addString(verdict)
          .addString(`transfer of ${transferAmount} HBAR`),
      );

    const txResponse = await tx.execute(kit.client);
    const receipt = await txResponse.getReceipt(kit.client);
    console.log("Assessment tx status:", receipt.status.toString());
  } catch (e: any) {
    console.log("Contract interaction:", e.message);
  }

  console.log("\n=== Agent mission complete ===\n");
}

// ============================================================
//  MAIN
// ============================================================
async function main() {
  console.log(`Network mode: ${NETWORK}`);
  if (NETWORK === "hedera") {
    await runHedera();
  } else {
    await runLocal();
  }
}

main().catch((err) => {
  console.error("Agent fatal error:", err);
  process.exit(1);
});
