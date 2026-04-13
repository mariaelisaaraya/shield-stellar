"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Map,
  Menu,
  X,
} from "lucide-react";
import { useStellarWallet } from "@/components/providers";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/map", label: "Arena Map", icon: Map },
];

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#5b5cf6" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="12" r="6" stroke="#5b5cf6" strokeWidth="1.5" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="#5b5cf6" />
      <line x1="12" y1="12" x2="12" y2="2" stroke="#5b5cf6" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

function WalletSection() {
  const { publicKey, isConnected, isFreighterAvailable, displayName, connect } =
    useStellarWallet();

  if (isConnected && publicKey) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ backgroundColor: "#f7f7f8", border: "1px solid #ebebed" }}
      >
        <span className="block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "#15803d" }} />
        <span className="font-mono text-[11px]" style={{ color: "#a1a1aa" }}>
          {displayName}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={!isFreighterAvailable}
      className="inline-flex w-full items-center justify-center h-9 rounded-md text-xs font-medium text-white transition-colors disabled:opacity-50"
      style={{ backgroundColor: "#5b5cf6" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#5b5cf6")}
    >
      {isFreighterAvailable ? "Connect Freighter" : "Install Freighter"}
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
        <RadarIcon className="w-5 h-5 shrink-0" />
        <span className="text-sm font-bold tracking-tight" style={{ color: "#0f0f10" }}>
          ShieldStellar
        </span>
      </div>

      {/* Section label */}
      <div className="px-5 mb-2">
        <span
          className="font-mono tracking-[0.15em]"
          style={{ fontSize: "10px", color: "#a1a1aa" }}
        >
          ARENA
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                active ? "font-medium" : "",
              )}
              style={
                active
                  ? { backgroundColor: "#efefff", color: "#5b5cf6" }
                  : { color: "#52525b" }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "#f7f7f8";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet — bottom */}
      <div className="px-4 pb-5 pt-4" style={{ borderTop: "1px solid #ebebed" }}>
        <WalletSection />
      </div>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-dvh w-[240px] flex-col z-40"
        style={{ backgroundColor: "#ffffff", borderRight: "1px solid #ebebed" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between px-4"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #ebebed" }}
      >
        <Link href="/map" className="flex items-center gap-2.5">
          <RadarIcon className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold tracking-tight" style={{ color: "#0f0f10" }}>
            ShieldStellar
          </span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          style={{ color: "#a1a1aa" }}
          className="transition-colors"
          onMouseEnter={(e) => (e.currentTarget.style.color = "#5b5cf6")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-dvh w-[240px] flex flex-col z-50 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "#ffffff", borderRight: "1px solid #ebebed" }}
      >
        <SidebarContent onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
