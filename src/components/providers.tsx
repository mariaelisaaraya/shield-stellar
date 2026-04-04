"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";
import { initLedger } from "@/lib/ledger";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000 },
        },
      }),
  );

  useEffect(() => { initLedger(); }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
