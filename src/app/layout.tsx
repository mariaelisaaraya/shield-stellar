import type { Metadata, Viewport } from "next";
import { Inter, Inconsolata } from "next/font/google";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#060d06",
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
          <main
            className="min-h-dvh w-full overflow-y-auto"
            style={{ backgroundColor: "#f7f7f8" }}
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
