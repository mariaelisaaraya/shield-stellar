import type { Metadata } from "next";
import { Inter, Inconsolata } from "next/font/google";

import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ShieldStellar",
  description: "AI agent risk assessment with x402 payments on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${inconsolata.variable} min-h-dvh antialiased`}
        style={{ backgroundColor: "#f7f7f8", color: "#0f0f10" }}
      >
        <Providers>
          <Sidebar />
          <main
            className="md:ml-[240px] min-h-dvh overflow-y-auto px-4 py-6 md:px-8 md:py-8"
            style={{ backgroundColor: "#f7f7f8" }}
          >
            <div className="max-w-5xl">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
