"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";
import {
  isFreighterInstalled,
  getFreighterPublicKey,
  formatStellarAddress,
} from "@/lib/stellar";

// --- Stellar Wallet Context ---

interface StellarWalletState {
  publicKey: string | null;
  isConnected: boolean;
  isFreighterAvailable: boolean;
  displayName: string;
  connectError: string | null;
  connect: () => Promise<void>;
}

const StellarWalletContext = createContext<StellarWalletState>({
  publicKey: null,
  isConnected: false,
  isFreighterAvailable: false,
  displayName: "",
  connectError: null,
  connect: async () => {},
});

export const useStellarWallet = () => useContext(StellarWalletContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      }),
  );

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isFreighterAvailable, setIsFreighterAvailable] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    isFreighterInstalled().then(setIsFreighterAvailable);
  }, []);

  const connect = async () => {
    try {
      setConnectError(null);
      const key = await getFreighterPublicKey();
      if (key) {
        setPublicKey(key);
        setConnectError(null);
      } else {
        setConnectError("No se pudo conectar Freighter. Revisa permisos de la extension.");
      }
    } catch {
      setConnectError("Error al conectar wallet. Intenta de nuevo y revisa Freighter.");
    }
  };

  const walletState: StellarWalletState = {
    publicKey,
    isConnected: !!publicKey,
    isFreighterAvailable,
    displayName: publicKey ? formatStellarAddress(publicKey) : "",
    connectError,
    connect,
  };

  return (
    <StellarWalletContext.Provider value={walletState}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </StellarWalletContext.Provider>
  );
}
