// --- x402 Protocol Configuration for Stellar ---
//
// Official packages:
//   @x402/core     — protocol types and interfaces
//   @x402/stellar  — Stellar-specific schemes (client/server/facilitator)
//   @x402/express  — Express middleware (paymentMiddlewareFromConfig)
//   @x402/fetch    — x402Client, x402HTTPClient (payment-aware fetch)
//
// References:
//   https://github.com/stellar/x402-stellar
//   https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide
//
// CAIP-2 network identifiers per x402 spec

export const X402_NETWORKS = {
  testnet: "stellar:testnet",
  pubnet: "stellar:pubnet",
} as const;

export const X402_FACILITATORS = {
  // Testnet: fees sponsored by facilitator
  testnet: "https://www.x402.org/facilitator",
  // Pubnet: OpenZeppelin Channels
  pubnet: "https://channels.openzeppelin.com/x402",
} as const;

export const X402_CONFIG = {
  facilitatorUrl:
    process.env.NEXT_PUBLIC_X402_FACILITATOR_URL ||
    X402_FACILITATORS.testnet,

  scheme: "exact" as const,

  network:
    (process.env.NEXT_PUBLIC_X402_NETWORK as string) ||
    X402_NETWORKS.testnet,

  // Stellar address that receives micropayments for risk assessments
  payTo: process.env.NEXT_PUBLIC_X402_PAY_TO || "",
} as const;

// --- Price Definitions for API Endpoints ---

export const ENDPOINT_PRICES: Record<
  string,
  { price: string; description: string }
> = {
  "/api/verdict": {
    price: "$0.001",
    description: "Risk verdict evaluation for an agent transaction",
  },
  "/api/stats": {
    price: "$0.0005",
    description: "Dashboard statistics from on-chain data",
  },
  "/api/assessments": {
    price: "$0.001",
    description: "Assessment history query",
  },
  "/api/cre-simulate": {
    price: "$0.005",
    description: "Batch risk simulation",
  },
};

// --- Route config builder for @x402/express middleware ---
//
// Server usage (Express):
//   import { paymentMiddlewareFromConfig } from "@x402/express";
//   import { HTTPFacilitatorClient } from "@x402/core/server";
//   import { ExactStellarScheme } from "@x402/stellar/exact/server";
//
//   app.use(
//     paymentMiddlewareFromConfig(
//       buildRouteConfig(),
//       new HTTPFacilitatorClient({ url: X402_CONFIG.facilitatorUrl }),
//       [{ network: X402_CONFIG.network, server: new ExactStellarScheme() }],
//     ),
//   );

export function buildRouteConfig() {
  const routes: Record<
    string,
    {
      accepts: {
        scheme: string;
        price: string;
        network: string;
        payTo: string;
      };
    }
  > = {};

  for (const [path, config] of Object.entries(ENDPOINT_PRICES)) {
    routes[`GET ${path}`] = {
      accepts: {
        scheme: X402_CONFIG.scheme,
        price: config.price,
        network: X402_CONFIG.network,
        payTo: X402_CONFIG.payTo,
      },
    };
  }
  return routes;
}

// --- x402 Headers ---

export const X402_HEADERS = {
  paymentSignature: "PAYMENT-SIGNATURE",
  paymentResponse: "PAYMENT-RESPONSE",
} as const;

// --- Test endpoints (xlm402.com) for development ---

export const XLM402_TESTNET_ENDPOINTS = {
  weather: "https://xlm402.com/testnet/weather/current",
  news: "https://xlm402.com/testnet/news/tech",
  crypto: "https://xlm402.com/testnet/markets/crypto/quote",
} as const;
