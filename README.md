# ShieldStellar

**Pay-per-query risk assessment for AI agents on Stellar.**

An autonomous agent calls one HTTP endpoint, pays $0.001 in USDC over [x402](https://www.x402.org), and gets back a verdict — `ALLOW`, `WARN`, or `BLOCK` — for the transaction it's about to send. The score is derived server-side from the agent's stated inputs (target address, amount, action), evaluated against on-chain policy thresholds in a Soroban contract, and the assessment is recorded permanently on Stellar.

No accounts. No API keys. No subscription. The agent pays for what it asks, the answer is auditable on-chain, and a malicious caller cannot fake a "safe" verdict by lying about the score because the server computes the score itself.

**Live demo:** https://shield-stellar.onrender.com

---

## The problem

Stellar's DeFi ecosystem reached real scale in late 2025 / early 2026: [Blend](https://docs.blend.capital) hit $80M+ TVL, [Aquarius](https://aqua.network) crossed $40M, and Soroban-native protocols like [Soroswap](https://docs.soroswap.finance) and Sushi started attracting agents that move USDC programmatically. None of those protocols ship with **counterparty screening** built in — there's no on-chain "is this address safe to interact with?" service that an autonomous agent can call before signing.

The cost of getting it wrong is not theoretical. In early 2026, an oracle feeding the **YieldBlox** lending pool on Stellar was compromised; community action recovered 100% of funds, but the incident showed exactly what an agent operating against YieldBlox in the days before would have lacked: any way to ask "is this target known-risky right now?" before committing the transaction. That question is what ShieldStellar answers.

> "Late February compromise of an oracle serving the YieldBlox pool" — [What the DeFi is Happening on Stellar](https://stellar.org/blog/ecosystem/what-the-defi-is-happening-on-stellar), Stellar Foundation, 2026.

ShieldStellar fills the gap with the unit of value AI agents already understand: HTTP requests with stablecoin micropayments. An agent that touches a verified Stellar DeFi protocol gets that context surfaced; an agent that touches an address on the known-risky list gets `BLOCK`; everything else is scored from the inputs the agent declared, and the answer is recorded on-chain so the operator can audit it later.

---

## How it works

```
AI Agent                          ShieldStellar                      Stellar Network
   |                                    |                                   |
   |  1. POST /verdict                  |                                   |
   |     { target, amountUsd, action }  |                                   |
   | ---------------------------------> |                                   |
   |                                    |                                   |
   |  2. HTTP 402 — pay $0.001 USDC     |                                   |
   | <--------------------------------- |                                   |
   |                                    |                                   |
   |  3. Signs USDC payment on Stellar  |                                   |
   | ---------------------------------> |                                   |
   |                                    |  4. Facilitator settles on-chain  |
   |                                    | --------------------------------> |
   |                                    |          <5 seconds               |
   |                                    | <-------------------------------- |
   |                                    |                                   |
   |                                    |  5. Compute score from inputs +   |
   |                                    |     evaluate vs PolicyManager     |
   |                                    | --------------------------------> |
   |                                    | <-------------------------------- |
   |                                    |                                   |
   |  6. Verdict: ALLOW / WARN / BLOCK  |                                   |
   |     + score, reasons, inputs       |                                   |
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
| Risk scoring engine | Pure server-side function over `{ target, amountUsd, action }` — clients cannot fake the score |
| Verified protocols registry | Curated list of real Stellar/Soroban DeFi contract IDs (Blend, Aquarius, Soroswap…) used to enrich verdicts |
| Idempotency | In-memory TTL+LRU cache keyed by `Idempotency-Key` header (Stripe-style replay safety) |
| Health probe | `GET /api/health` calls Soroban RPC `getHealth` directly — wired to Render healthcheck |
| Deploy | Render (unified Next.js + Express server) |

## Soroban contracts (Stellar Testnet)

| Contract | ID | Purpose |
|----------|----|---------|
| **AgentRegistry** | `CDWN6MDYAFTK5UNR64VD33IAR7LIU3S7LS262GHQCF3EJ3URJRKYMGB6` | Register agent identities |
| **PolicyManager** | `CCHDG3TKMH6GWTYPPG5HYAD23YEQXDMMSPJM7VIHJUKVN652TEMUM7N6` | ALLOW/WARN/BLOCK thresholds |
| **AssessmentRegistry** | `CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST` | On-chain assessment records |

All contracts use `#[only_owner]` access control. 11 Soroban contract tests + 11 scoring engine tests + 18 handler tests + 13 verified-protocols tests — **53 total**, all passing. Verified on [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCDUJPZRP6Y62BNDIT3JBSLLOOX4IZTAXHTEWL6AO7NGCTF2P4KNRWST).

## Verified protocols registry

`server/data/verified-protocols.mjs` is a curated list of real Stellar / Soroban DeFi contract addresses, sourced from each protocol's own documentation. When the risk scoring engine sees a target on this list, it knows the address is a published protocol contract — not a random unknown counterparty — and surfaces that context in the verdict's `reasons` field. The registry is used as **context, not as an allowlist**: a verified protocol target can still earn a `BLOCK` if the amount or action is risky enough.

| Protocol | Network | What it is | Source |
|----------|---------|------------|--------|
| **Blend V2** (Pool Factory, Backstop, Emitter, BLND token) | mainnet + testnet | Lending primitive on Soroban, ~$80M TVL | [docs.blend.capital](https://docs.blend.capital/mainnet-deployments) |
| **Soroswap** (Factory, Router) | mainnet | Open-source AMM modeled on Uniswap v2 | [docs.soroswap.finance](https://docs.soroswap.finance) |
| **Aquarius AMM** | mainnet | DEX and liquidity hub, ~$40M TVL | [docs.aqua.network](https://docs.aqua.network) |
| **Comet BLND:USDC LP** | mainnet | Weighted-pool liquidity for the BLND:USDC pair | [docs.blend.capital](https://docs.blend.capital/mainnet-deployments) |

Adding a protocol takes one entry: contract ID, name, category, network, and a `verifiedSource` URL pointing to where the address was originally published. The module validates every entry at load time so a typo crashes startup instead of silently corrupting verdicts.

## x402 payment flow

The x402 protocol uses the HTTP `402 Payment Required` status code to put a price tag on real API calls:

1. Agent sends `POST /x402/verdict` with body `{ target, amountUsd, action }`.
2. Server returns **HTTP 402** with payment requirements ($0.001 USDC).
3. Agent signs a Soroban USDC transfer and retries with the `PAYMENT-SIGNATURE` header.
4. Facilitator (x402.org) verifies and settles on Stellar in <5 seconds.
5. Server computes the risk score from the body, evaluates it against the on-chain PolicyManager thresholds, and returns `{ verdict, score, reasons, inputs }`.
6. Assessment is recorded on-chain in AssessmentRegistry.

**Idempotency:** if the agent sends an `Idempotency-Key` header and the network drops the response after settlement, retrying with the same key replays the exact same verdict — no double-charge, no recomputation. Reusing the same key with a different body returns `409 Conflict` (Stripe convention).

No API keys. No subscriptions. The agent pays per call and the answer is auditable on-chain.

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
