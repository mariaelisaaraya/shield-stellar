"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Shield,
  Zap,
  Clock,
  Link2,
  Menu,
  X,
} from "lucide-react";
import { useAccount, useConnect, useEnsName, useEnsAvatar } from "wagmi";
import { injected } from "wagmi/connectors";
import { cn } from "@/lib/utils";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/policy", label: "Policy", icon: Shield },
  { href: "/simulate", label: "Simulate", icon: Zap },
  { href: "/history", label: "History", icon: Clock },
  { href: "/workflow", label: "CRE Workflow", icon: Link2 },
];

function RadarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="12" r="6" stroke="#2563EB" strokeWidth="1.5" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="#2563EB" />
      <line x1="12" y1="12" x2="12" y2="2" stroke="#2563EB" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

function WalletSection() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ?? undefined, chainId: 1 });

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 px-1">
        {ensAvatar ? (
          <img src={ensAvatar} alt="" className="h-6 w-6 rounded-full shrink-0" />
        ) : (
          <span className="block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
        )}
        <div className="flex flex-col">
          {ensName && (
            <span className="text-[12px] font-medium" style={{ color: "#ccc" }}>{ensName}</span>
          )}
          <span className="font-mono text-[11px]" style={{ color: "#666" }}>
            {shortAddress(address)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="group relative inline-flex w-full rounded-md transition-shadow hover:shadow-[0_0_20px_rgba(37,99,235,0.25)]"
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
          style={{ backgroundColor: "#0a0a0a" }}
        />
      </span>
      <span className="relative z-10 inline-flex h-9 w-full items-center justify-center text-xs font-medium text-white">
        Connect Wallet
      </span>
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
        <span className="text-sm font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
          AegisPay
        </span>
      </div>

      {/* Section label */}
      <div className="px-5 mb-2">
        <span
          className="font-mono tracking-[0.1em]"
          style={{ fontSize: "10px", color: "#444" }}
        >
          PLATFORM
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
                "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                active ? "text-white" : "text-[#555] hover:text-[#888]",
              )}
              style={
                active
                  ? { backgroundColor: "#141414", borderLeft: "2px solid #2563EB" }
                  : { borderLeft: "2px solid transparent" }
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet — bottom */}
      <div className="px-4 pb-5 pt-4" style={{ borderTop: "1px solid #1a1a1a" }}>
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
        style={{ backgroundColor: "#0a0a0a", borderRight: "1px solid #1a1a1a" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between px-4"
        style={{ backgroundColor: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <RadarIcon className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold tracking-tight" style={{ color: "#f0f0f0" }}>
            AegisPay
          </span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="text-[#666] hover:text-white transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-dvh w-[240px] flex flex-col z-50 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundColor: "#0a0a0a", borderRight: "1px solid #1a1a1a" }}
      >
        <SidebarContent onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
