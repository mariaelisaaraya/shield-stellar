# ShieldStellar

Pay-per-query risk assessment for AI agents on Stellar.

ShieldStellar gates risk-evaluation APIs behind x402 micropayments (HTTP 402), computes ALLOW/WARN/BLOCK using Soroban policy logic, and records assessments on-chain for auditability.

- Live demo: https://shield-stellar.onrender.com
- Network: Stellar Testnet
- Main UX: map-first "Verdict Arena" at /

---

## Hackathon readiness checklist

- [x] Public repo with runnable code
- [x] Live demo URL
- [x] Soroban smart contracts deployed on testnet
- [x] Clear architecture + end-to-end transaction flow
- [x] Local setup and env variable documentation
- [x] On-chain verification links (contracts/tx explorer)
- [x] Test instructions for contracts
- [x] Testnet constraints + fallback behavior documented
- [x] "Who signs what" documented

---

## Problem and solution

### Problem
AI agents need machine-verifiable risk checks before executing payments or contract interactions. Most APIs use API keys and off-chain trust, with weak economic spam resistance.

### Solution
ShieldStellar introduces:
1. x402 payment-gated risk endpoints (`/x402/*`) for usage-based monetization.
2. Soroban policy evaluation for deterministic ALLOW/WARN/BLOCK verdicts.
3. On-chain assessment attestation for transparent, permanent audit trail.

---

## Architecture

```text
Client/Agent
  |
  | 1) Request verdict
  v
ShieldStellar API (Next.js + Express)
  |
  | 2) x402 middleware may return HTTP 402
  | 3) Client signs payment tx and retries
  v
x402 Facilitator + Stellar settlement
  |
  | 4) API reads policy from Soroban
  | 5) API writes assessment to Soroban registry
  v
Stellar Testnet (Soroban + tx history)
```

### Runtime components
- Next.js app router for UI + API routes
- Unified Node server (`start.js`) combining Next + Express `/x402`
- Soroban read calls via RPC simulation
- Soroban write calls signed server-side for attestation

---

## Smart contracts (Stellar Testnet)

| Contract | ID | Purpose |
|---|---|---|
| AgentRegistry | `CDWN6MDYAFTK5UNR64VD33IAR7LIU3S7LS262GHQCF3EJ3URJRKYMGB6` | Agent identity registry |
| PolicyManager | `CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6` | Risk thresholds + verdict logic |
| AssessmentRegistry | `CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST` | On-chain assessment records |

- Explorer (example contract): https://stellar.expert/explorer/testnet/contract/CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST
- Access control: owner-restricted admin paths in contracts

---

## x402 flow (API monetization)

1. Client requests `GET /x402/verdict?score=N`
2. If payment is required, API returns HTTP 402 with pricing metadata
3. Client signs Stellar payment and retries with payment proof headers
4. Facilitator verifies and settles
5. API returns verdict and can persist assessment on-chain

Current pricing defaults:
- `GET /x402/verdict`: $0.001
- `GET /x402/stats`: $0.0005
- `GET /x402/thresholds`: $0.0005

If `PAY_TO` is not set, x402 gate is disabled (demo mode behavior).

---

## Who signs what

| Action | Signer |
|---|---|
| x402 payment transaction | End-user/agent wallet |
| Soroban read calls (simulate) | No signature required |
| Assessment write (`create_assessment`) | Server signer (`DEPLOYER_SECRET`) |

---

## Local development

### 1) Install dependencies

Windows PowerShell note: use `npm.cmd` if `npm` is blocked by execution policy.

```bash
npm.cmd install
```

### 2) Run app (unified server)

```bash
npm.cmd start
```

App will run on `http://localhost:3000` and expose `/x402/*` through the same process.

### 3) Optional dev mode

```bash
npm.cmd run dev
```

---

## Environment variables

Create `.env` at repo root as needed:

```bash
PAY_TO=G...                # Stellar destination for x402 settlement (enables payment gate)
DEPLOYER_SECRET=S...       # Server signer for Soroban write attestations
```

Notes:
- Missing `PAY_TO`: app still runs, x402 gate disabled.
- Missing `DEPLOYER_SECRET`: read paths work, on-chain assessment write fails.

---

## Contract build and test

```bash
cd contracts
stellar contract build
cargo test
```

Requirements:
- Rust toolchain with Soroban target
- Stellar CLI installed and configured

---

## Testnet constraints and fallback behavior

Following Stellar hackathon best practices:

1. External services can be unavailable or partially configured in testnet.
2. The app supports graceful degradation:
   - Without `PAY_TO`, x402 gate is bypassed for demo continuity.
   - Without `DEPLOYER_SECRET`, verdicts still render, attestation write is surfaced as non-fatal.
3. UI still demonstrates complete product flow (score, payment step, verdict, history context) even when a dependency is missing.

---

## Troubleshooting

### Freighter not connecting
- Ensure extension is installed and unlocked.
- Refresh app and reconnect.

### Payment endpoint not charging
- Check `PAY_TO` is set in environment.
- Verify request path is under `/x402/*`.

### Assessment write fails
- Set valid `DEPLOYER_SECRET` funded on testnet.
- Confirm Soroban RPC reachable: `https://soroban-testnet.stellar.org`.

### Repo run issues on Windows
- Use `npm.cmd` instead of `npm` in PowerShell environments with strict execution policy.

---

## Tech stack

- Frontend: Next.js 14, React, Tailwind, Framer Motion
- Wallet: Freighter
- API/server: Express + Next unified server
- Payments: `@x402/express`, `@x402/stellar`
- Chain: Stellar Testnet + Soroban RPC
- Contracts: Rust/Soroban

---

## Project structure (high level)

```text
src/                    # Next.js app + UI + API routes
contracts/              # Soroban contracts workspace
server/                 # Alternate standalone x402 server
agent-x402/             # Example x402 client
start.js                # Unified production/local server entrypoint
```
