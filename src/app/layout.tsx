import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Sidebar } from "@/components/sidebar";
import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "AegisPay",
  description: "Hackathon demo — AegisPay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-dvh font-sans antialiased bg-background text-foreground`}
      >
        <Providers>
          <Sidebar />
          <main
            className="md:ml-[240px] min-h-dvh overflow-y-auto px-4 py-6 md:px-8 md:py-8"
            style={{ backgroundColor: "#080808" }}
          >
            <div className="max-w-5xl">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
