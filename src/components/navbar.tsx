"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const links = [
  { href: "/agents", label: "AGENTS" },
  { href: "/policy", label: "POLICY" },
  { href: "/simulate", label: "SIMULATE" },
  { href: "/history", label: "HISTORY" },
];

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="12" r="6" stroke="#2563EB" strokeWidth="1.5" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="#2563EB" />
      <line x1="12" y1="12" x2="12" y2="2" stroke="#2563EB" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ backgroundColor: "#080808", borderBottom: "1px solid #1a1a1a" }}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <RadarIcon className="w-5 h-5" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            AegisPay
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "font-mono text-[11px] tracking-[0.08em] transition-colors",
                pathname === l.href
                  ? "text-[#2563EB]"
                  : "text-[#666] hover:text-[#999]",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side: wallet + mobile toggle */}
        <div className="flex items-center gap-3">
          {isConnected && address ? (
            <div className="flex items-center gap-2 font-mono text-[12px] text-[#999]">
              <span className="block h-2 w-2 rounded-full bg-emerald-500" />
              {shortAddress(address)}
            </div>
          ) : (
            <button
              onClick={() => {
                try {
                  connect({ connector: injected() });
                } catch {
                  /* no wallet available — do nothing */
                }
              }}
              className="group relative inline-flex rounded-md transition-shadow hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]"
            >
              <span
                className="absolute inset-0 rounded-md opacity-80 group-hover:opacity-100 transition-opacity"
                style={{
                  background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                  padding: "1.5px",
                }}
              >
                <span
                  className="block h-full w-full rounded-[5px]"
                  style={{ backgroundColor: "#080808" }}
                />
              </span>
              <span className="relative z-10 inline-flex h-8 items-center px-4 text-xs font-medium text-white">
                Connect Wallet
              </span>
            </button>
          )}

          {/* Mobile toggle */}
          <button
            className="sm:hidden text-[#666] hover:text-foreground transition-colors"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden" style={{ backgroundColor: "#080808", borderTop: "1px solid #1a1a1a" }}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-6 py-3 font-mono text-[11px] tracking-[0.08em] transition-colors",
                pathname === l.href
                  ? "text-[#2563EB] bg-white/[0.02]"
                  : "text-[#666] hover:text-[#999] hover:bg-white/[0.02]",
              )}
              style={{ borderBottom: "1px solid #1a1a1a" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
