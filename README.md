# ShieldStellar

Pay-per-query risk assessment for AI agents on Stellar.

AI agents pay a USDC micropayment via the x402 protocol to check if a transaction is safe before executing it. The risk verdict is computed by a Soroban smart contract and permanently recorded on-chain.

**Live demo:** https://shield-stellar.onrender.com

---

## How it works

```
AI Agent                          ShieldStellar                      Stellar Network
   |                                    |                                   |
   |  1. "Is this transaction safe?"    |                                   |
   | ---------------------------------> |                                   |
   |                                    |                                   |
   |  2. HTTP 402 — pay $0.001 USDC    |                                   |
   | <--------------------------------- |                                   |
   |                                    |                                   |
   |  3. Signs USDC payment on Stellar  |                                   |
   | ---------------------------------> |                                   |
   |                                    |  4. Facilitator settles on-chain  |
   |                                    | --------------------------------> |
   |                                    |          <5 seconds               |
   |                                    | <-------------------------------- |
   |                                    |                                   |
   |                                    |  5. Reads verdict from Soroban    |
   |                                    | --------------------------------> |
   |                                    | <-------------------------------- |
   |                                    |                                   |
   |  6. Verdict: ALLOW / WARN / BLOCK |                                   |
   | <--------------------------------- |                                   |
   |                                    |                                   |
   |                                    |  7. Assessment recorded on-chain  |
   |                                    | --------------------------------> |
   |                                    |     (permanent attestation)       |
```

## What each page does

| Page | Description |
|------|-------------|
| **Dashboard** | Live stats from Soroban: total risk checks, blocked transactions, average score |
| **Risk Check** | Input a target + amount, see the full x402 payment flow, get a verdict from Soroban |
| **Policy** | Current risk thresholds from the PolicyManager contract (owner-only updates) |
| **History** | On-chain audit trail of every assessment with link to Stellar Expert |

## Tech stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Wallet | Freighter (Stellar) |
| Smart contracts | 3 Soroban contracts with OpenZeppelin `stellar-access` v0.7.0 |
| x402 payments | `@x402/express` + `@x402/stellar` — HTTP 402 micropayments |
| Settlement | USDC on Stellar Testnet via x402.org facilitator |
| Deploy | Render (unified Next.js + Express server) |

## Soroban contracts (Stellar Testnet)

| Contract | ID | Purpose |
|----------|----|---------|
| **AgentRegistry** | `CDWN6MDYAFTK5UNR64VD33IAR7LIU3S7LS262GHQCF3EJ3URJRKYMGB6` | Register agent identities |
| **PolicyManager** | `CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6` | ALLOW/WARN/BLOCK thresholds |
| **AssessmentRegistry** | `CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST` | On-chain assessment records |

All contracts use `#[only_owner]` access control. 11 tests passing. Verified on [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST).

## x402 payment flow

The x402 protocol activates the HTTP `402 Payment Required` status code for real payments:

1. Agent requests `/x402/verdict?score=50`
2. Server returns **HTTP 402** with payment requirements ($0.001 USDC)
3. Agent signs a Soroban USDC transfer and retries with `PAYMENT-SIGNATURE` header
4. Facilitator (x402.org) verifies and settles on Stellar in <5 seconds
5. Server returns the verdict from the PolicyManager contract
6. Assessment is recorded on-chain in AssessmentRegistry

No API keys. No subscriptions. Just pay and get the answer.

## Local development

```bash
# Frontend
npm install
npm run dev

# x402 server (separate terminal)
cd server
npm install
echo "PAY_TO=YOUR_STELLAR_ADDRESS" > .env
node server.js

# Agent client (separate terminal)
cd agent-x402
npm install
echo "STELLAR_PRIVATE_KEY=YOUR_SECRET_KEY" > .env
node client.js
```

## Soroban contracts

```bash
cd contracts
stellar contract build
cargo test
```

Requires: Rust 1.84+, `wasm32v1-none` target, Stellar CLI v25+.
