import * as StellarSdk from "@stellar/stellar-sdk";

// --- Network Configuration ---

export const STELLAR_NETWORKS = {
  testnet: {
    name: "Stellar Testnet",
    networkPassphrase: StellarSdk.Networks.TESTNET,
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  pubnet: {
    name: "Stellar Pubnet",
    networkPassphrase: StellarSdk.Networks.PUBLIC,
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban-rpc.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/public",
  },
} as const;

export type StellarNetwork = keyof typeof STELLAR_NETWORKS;

const currentNetwork: StellarNetwork =
  (process.env.NEXT_PUBLIC_STELLAR_NETWORK as StellarNetwork) || "testnet";

export const network = STELLAR_NETWORKS[currentNetwork];

// --- Clients (Horizon for balances/history, Soroban RPC for contracts) ---

export function getHorizonServer() {
  return new StellarSdk.Horizon.Server(network.horizonUrl);
}

export function getSorobanServer() {
  return new StellarSdk.rpc.Server(network.sorobanRpcUrl);
}

// --- Keypair Helpers ---

export function keypairFromSecret(secret: string): StellarSdk.Keypair {
  return StellarSdk.Keypair.fromSecret(secret);
}

export function publicKeyFromSecret(secret: string): string {
  return StellarSdk.Keypair.fromSecret(secret).publicKey();
}

// --- Account Helpers ---

export async function getAccount(publicKey: string) {
  const server = getHorizonServer();
  return server.loadAccount(publicKey);
}

export async function getNativeBalance(publicKey: string): Promise<string> {
  const account = await getAccount(publicKey);
  const native = account.balances.find((b) => b.asset_type === "native");
  return native ? native.balance : "0";
}

export async function getTokenBalance(
  publicKey: string,
  assetCode: string,
  assetIssuer: string
): Promise<string> {
  const account = await getAccount(publicKey);
  const token = account.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      "asset_code" in b &&
      b.asset_code === assetCode &&
      "asset_issuer" in b &&
      b.asset_issuer === assetIssuer
  );
  return token ? token.balance : "0";
}

// --- USDC on Stellar (Soroban token contracts) ---

export const USDC_CONTRACTS = {
  testnet: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  pubnet: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
} as const;

export const USDC_DECIMALS = 7;

export const USDC_TESTNET = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  contract: USDC_CONTRACTS.testnet,
};

// --- Friendbot (testnet funding) ---

export async function fundTestnetAccount(publicKey: string): Promise<boolean> {
  if (currentNetwork !== "testnet") return false;
  try {
    const response = await fetch(
      `${STELLAR_NETWORKS.testnet.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
    );
    return response.ok;
  } catch {
    return false;
  }
}

// --- Freighter Wallet (v6+ API) ---

function extractFreighterAddress(value: unknown): string | null {
  if (typeof value === "string") {
    return value.startsWith("G") ? value : null;
  }

  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const address = rec.address;
    const publicKey = rec.publicKey;

    if (typeof address === "string" && address.startsWith("G")) return address;
    if (typeof publicKey === "string" && publicKey.startsWith("G")) return publicKey;
  }

  return null;
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (window.freighterApi) return true;

  try {
    const freighter = await import("@stellar/freighter-api");
    return (
      typeof freighter.getPublicKey === "function" ||
      typeof freighter.requestAccess === "function"
    );
  } catch {
    return false;
  }
}

export async function getFreighterPublicKey(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const api = window.freighterApi;

  try {
    // Prefer direct injected API when available.
    if (api) {
      if (typeof api.getPublicKey === "function") {
        const key = await api.getPublicKey();
        const fromPublicKey = extractFreighterAddress(key);
        if (fromPublicKey) return fromPublicKey;
      }

      if (typeof api.requestAccess === "function") {
        const access = await api.requestAccess();
        const fromAccess = extractFreighterAddress(access);
        if (fromAccess) return fromAccess;
      }
    }

    // Fallback to SDK API shape used by different Freighter versions.
    const freighter = await import("@stellar/freighter-api");

    if (typeof freighter.getPublicKey === "function") {
      try {
        const key = await freighter.getPublicKey();
        const fromPublicKey = extractFreighterAddress(key);
        if (fromPublicKey) return fromPublicKey;
      } catch {
        // Fall through to requestAccess.
      }
    }

    if (typeof freighter.requestAccess === "function") {
      const access = await freighter.requestAccess();
      const fromAccess = extractFreighterAddress(access);
      if (fromAccess) return fromAccess;
    }

    return null;
  } catch (error) {
    console.warn("Freighter connect failed:", error);
    return null;
  }
}

// --- Address Formatting ---

export function formatStellarAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// --- Assets ---

export function buildStellarAsset(
  code: string,
  issuer: string
): StellarSdk.Asset {
  return new StellarSdk.Asset(code, issuer);
}

export const XLM = StellarSdk.Asset.native();
