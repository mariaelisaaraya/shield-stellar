import AgentRegistryABI from "@/contracts/abis/AgentRegistry.json";
import PolicyManagerABI from "@/contracts/abis/PolicyManager.json";
import AssessmentRegistryABI from "@/contracts/abis/AssessmentRegistry.json";

export const CONTRACT_ADDRESSES = {
  AgentRegistry: "0xe0595502b10398D7702Ed43eDcf8101Fd67c0991",
  PolicyManager: "0x226F68C0D8F26A478F4F64d2733376DAB98Fcc6c",
  AssessmentRegistry: "0xeA86E74c8c89a30F6180B4d5c3d9C58C981d3638",
} as const;

export const agentRegistryConfig = {
  address: CONTRACT_ADDRESSES.AgentRegistry as `0x${string}`,
  abi: AgentRegistryABI,
} as const;

export const policyManagerConfig = {
  address: CONTRACT_ADDRESSES.PolicyManager as `0x${string}`,
  abi: PolicyManagerABI,
} as const;

export const assessmentRegistryConfig = {
  address: CONTRACT_ADDRESSES.AssessmentRegistry as `0x${string}`,
  abi: AssessmentRegistryABI,
} as const;
