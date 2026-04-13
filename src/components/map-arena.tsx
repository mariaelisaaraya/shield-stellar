"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Bot,
  CreditCard,
  Landmark,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ShieldOff,
} from "lucide-react";
import { useStellarWallet } from "@/components/providers";

type Verdict = "ALLOW" | "WARN" | "BLOCK";
type Phase = "checking" | "marching" | "arrived" | "entering";
type StepStatus = "idle" | "active" | "done" | "error";

interface NPC {
  id: string;
  address: string;
  verdict?: Verdict;
  score?: number;
  reason?: string;
  timestamp?: number;
  explorerUrl?: string;
  txHash?: string;
  phase: Phase;
  offsetX: number;
  offsetY: number;
  historic: boolean;
}

interface InsideNPC {
  id: string;
  verdict: Verdict;
  address: string;
  x: number;
  y: number;
}

interface CheckResult {
  target: string;
  amount: number;
  action: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
  txHash?: string;
  explorerUrl?: string;
}

interface RecentAssessment {
  id: number;
  target: string;
  riskScore: number;
  verdict: Verdict;
  reason?: string;
  timestamp: number;
}

interface FlowStep {
  title: string;
  waiting: string;
  icon: typeof Bot;
}

const FLOW_STEPS: FlowStep[] = [
  { icon: Bot, title: "Compute risk score", waiting: "Analyzing transaction details" },
  { icon: CreditCard, title: "x402 payment gate", waiting: "Checking payment requirement" },
  { icon: Landmark, title: "Settle on Stellar", waiting: "USDC payment settles on-chain" },
  { icon: ShieldCheck, title: "Soroban verdict", waiting: "Contract evaluates risk" },
  { icon: FileCheck, title: "On-chain attestation", waiting: "Recording assessment" },
];

// ---------- layout positions (% of map container) ----------
const CASTLE: Record<Verdict, { x: number; y: number }> = {
  ALLOW: { x: 13, y: 34 },
  WARN:  { x: 50, y: 12 },
  BLOCK: { x: 84, y: 34 },
};
const SPAWN = { x: 50, y: 71 };
const GATE_OFFSET_Y = 14;

// ---------- color palettes ----------
const VC: Record<Verdict, {
  wall: string; mid: string; accent: string; glow: string;
  badgeBg: string; badgeFg: string; name: string;
  terrainFill: string; terrainStroke: string;
}> = {
  ALLOW: {
    wall: "#16a34a", mid: "#22c55e", accent: "#86efac",
    glow: "rgba(134,239,172,0.42)", badgeBg: "#dcfce7", badgeFg: "#166534",
    name: "EMERALD HAVEN", terrainFill: "#14532d", terrainStroke: "#4ade80",
  },
  WARN: {
    wall: "#d97706", mid: "#f59e0b", accent: "#fde68a",
    glow: "rgba(253,230,138,0.4)", badgeBg: "#fef9c3", badgeFg: "#854d0e",
    name: "GOLDEN TRIBUNAL", terrainFill: "#7c2d12", terrainStroke: "#fbbf24",
  },
  BLOCK: {
    wall: "#b91c1c", mid: "#dc2626", accent: "#fca5a5",
    glow: "rgba(252,165,165,0.4)", badgeBg: "#fee2e2", badgeFg: "#991b1b",
    name: "CRIMSON PRISON", terrainFill: "#450a0a", terrainStroke: "#f87171",
  },
};


// ---------- local risk scoring ----------
const ACTION_RISK: Record<string, number> = {
  transfer: 0, swap: 10, "contract-call": 15, mint: 10, other: 5,
};
function localScore(target: string, amount: number, action: string): number {
  let s = 10;
  const a = target.toUpperCase();
  if (a.includes("AAAA") || a.includes("DEAD")) s += 60;
  if (amount > 100) s += 35;
  else if (amount > 10) s += 20;
  else if (amount > 1) s += 10;
  else s += 5;
  s += ACTION_RISK[action] ?? 5;
  s += 10;
  return Math.min(100, Math.max(0, s));
}

function buildReasons(amount: number, action: string, verdict: Verdict): string[] {
  const reasons: string[] = [];
  if (amount > 100) reasons.push("High value transaction");
  else if (amount > 10) reasons.push("Moderate amount");
  else reasons.push("Low value transaction");
  if (action === "contract-call") reasons.push("Contract interaction detected");
  else if (action === "swap") reasons.push("Swap operation");
  else if (action === "mint") reasons.push("Mint operation");
  if (verdict === "BLOCK") reasons.push("Risk exceeds block threshold");
  else if (verdict === "WARN") reasons.push("Human review recommended");
  else reasons.push("All checks passed");
  return reasons;
}

// ---------- helpers ----------
function shortAddr(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 5)}…${a.slice(-4)}`;
}
function randOff(spread = 8) {
  return (Math.random() - 0.5) * spread;
}

function formatTime(ts?: number) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------- pixel-art castle SVG ----------
function PixelCastle({ verdict, marchingCount = 0, gateOpen = false }: { verdict: Verdict; marchingCount?: number; gateOpen?: boolean }) {
  const C = VC[verdict];
  const gateLift = gateOpen ? 8 : 0;
  const gateGlow = gateOpen ? C.accent : "#334155";
  const courtyard = verdict === "BLOCK" ? "#3f1414" : verdict === "WARN" ? "#5d4314" : "#1f4d2a";
  return (
    <svg
      viewBox="0 0 100 80"
      width="130"
      height="104"
      style={{ imageRendering: "pixelated", display: "block" }}
      aria-hidden="true"
    >
      {/* shadow */}
      <ellipse cx="50" cy="78" rx="38" ry="5" fill="rgba(0,0,0,0.5)" />

      {/* left tower */}
      <rect x="1"  y="16" width="28" height="64" fill={C.wall} />
      {/* left battlements */}
      <rect x="1"  y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="9"  y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="17" y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="23" y="5"  width="6"  height="12" fill={C.wall} />

      {/* right tower */}
      <rect x="71" y="16" width="28" height="64" fill={C.wall} />
      {/* right battlements */}
      <rect x="71" y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="79" y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="87" y="5"  width="6"  height="12" fill={C.wall} />
      <rect x="93" y="5"  width="6"  height="12" fill={C.wall} />

      {/* main wall */}
      <rect x="16" y="34" width="68" height="46" fill={C.mid} opacity="0.9" />

      {/* courtyard strip inspired by reference castles */}
      <rect x="24" y="36" width="52" height="16" fill={courtyard} opacity="0.95" />
      <rect x="28" y="40" width="10" height="8" fill={C.accent} opacity="0.16" />
      <rect x="62" y="40" width="10" height="8" fill={C.accent} opacity="0.16" />
      {/* wall battlements */}
      {[20, 28, 36, 44, 52, 60, 68, 76].map((x) => (
        <rect key={x} x={x} y="24" width="5" height="11" fill={C.mid} opacity="0.9" />
      ))}

      {/* gate with interaction feedback */}
      <rect x="38" y="54" width="24" height="26" fill="#050a05" />
      <ellipse cx="50" cy="54" rx="12" ry="7" fill="#050a05" />
      <rect x="39" y={55 - gateLift} width="22" height="23" fill="#111827" opacity="0.9" />
      <rect x="39" y={54 - gateLift} width="22" height="2" fill={gateOpen ? C.accent : "#475569"} opacity="0.8" />
      {[41, 45, 49, 53, 57].map((x) => (
        <rect key={x} x={x} y={56 - gateLift} width="1.3" height="20" fill={gateGlow} opacity={gateOpen ? 0.7 : 0.3} />
      ))}
      <rect x="40" y={58 - gateLift} width="20" height="2" fill={gateOpen ? C.accent : "#334155"} opacity="0.7" />
      {marchingCount > 0 && <circle cx="50" cy="67" r="3" fill={C.accent} opacity="0.35" />}

      {/* tower windows */}
      <rect x="5"  y="32" width="8" height="12" fill={C.accent} opacity="0.55" rx="1" />
      <rect x="15" y="32" width="8" height="12" fill={C.accent} opacity="0.55" rx="1" />
      <rect x="77" y="32" width="8" height="12" fill={C.accent} opacity="0.55" rx="1" />
      <rect x="87" y="32" width="8" height="12" fill={C.accent} opacity="0.55" rx="1" />

      <rect x="5"  y="50" width="8" height="10" fill={C.accent} opacity="0.3" rx="1" />
      <rect x="15" y="50" width="8" height="10" fill={C.accent} opacity="0.3" rx="1" />
      <rect x="77" y="50" width="8" height="10" fill={C.accent} opacity="0.3" rx="1" />
      <rect x="87" y="50" width="8" height="10" fill={C.accent} opacity="0.3" rx="1" />

      {/* flag poles */}
      <rect x="13" y="0" width="2" height="16" fill="#9ca3af" />
      <polygon points="15,0 15,10 24,5" fill={C.accent} />
      <rect x="85" y="0" width="2" height="16" fill="#9ca3af" />
      <polygon points="85,0 85,10 76,5" fill={C.accent} />

      {/* tiny threat glyphs for BLOCK to echo darker reference */}
      {verdict === "BLOCK" && (
        <>
          <circle cx="33" cy="35" r="1.5" fill="#7f1d1d" opacity="0.8" />
          <circle cx="67" cy="35" r="1.5" fill="#7f1d1d" opacity="0.8" />
        </>
      )}
    </svg>
  );
}

// ---------- pixel-art NPC sprite ----------
function NpcSprite({ verdict, size = 18 }: { verdict?: Verdict; size?: number }) {
  const head = verdict ? VC[verdict].accent : "#94a3b8";
  const body = verdict ? VC[verdict].wall   : "#475569";
  const h = Math.round(size * 1.7);

  return (
    <svg
      viewBox="0 0 10 17"
      width={size}
      height={h}
      style={{ imageRendering: "pixelated", display: "block" }}
      aria-hidden="true"
    >
      <rect x="2" y="0" width="6" height="6"  fill={head} />
      <rect x="3" y="1" width="1" height="2"  fill="#050a05" />
      <rect x="6" y="1" width="1" height="2"  fill="#050a05" />
      <rect x="3" y="4" width="4" height="1"  fill="#050a05" />
      <rect x="1" y="7" width="8" height="5"  fill={body} />
      <rect x="0" y="7" width="1" height="4"  fill={body} />
      <rect x="9" y="7" width="1" height="4"  fill={body} />
      <rect x="1" y="13" width="3" height="4" fill={body} />
      <rect x="6" y="13" width="3" height="4" fill={body} />
    </svg>
  );
}

// ---------- terrain decoration (SVG, viewBox 0–100 × 0–100) ----------
function TerrainSVG() {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      viewBox="0 0 100 56.25"
      preserveAspectRatio="none"
    >
      {/* roads */}
      <path
        d={`M ${SPAWN.x} ${SPAWN.y * 0.5625} Q 28 ${SPAWN.y * 0.5625} ${CASTLE.ALLOW.x} ${(CASTLE.ALLOW.y + 14) * 0.5625}`}
        stroke="rgba(34,197,94,0.4)" strokeWidth="1" fill="none"
      />
      <path
        d={`M ${SPAWN.x} ${SPAWN.y * 0.5625} L ${CASTLE.WARN.x} ${(CASTLE.WARN.y + 16) * 0.5625}`}
        stroke="rgba(245,158,11,0.42)" strokeWidth="1" fill="none"
      />
      <path
        d={`M ${SPAWN.x} ${SPAWN.y * 0.5625} Q 70 ${SPAWN.y * 0.5625} ${CASTLE.BLOCK.x} ${(CASTLE.BLOCK.y + 14) * 0.5625}`}
        stroke="rgba(220,38,38,0.4)" strokeWidth="1" fill="none"
      />

      {/* spawn indicator */}
      <circle cx={SPAWN.x} cy={SPAWN.y * 0.5625} r="1.4" fill="#3b82f6" opacity="0.8" />
      <circle cx={SPAWN.x} cy={SPAWN.y * 0.5625} r="3" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.4" />

    </svg>
  );
}


function GameHud({ total }: { total: number }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 40,
          border: "1px solid rgba(147,197,253,0.5)",
          backgroundColor: "rgba(15,23,42,0.68)",
          borderRadius: "10px",
          padding: "8px 10px",
          color: "#dbeafe",
          fontFamily: "monospace",
          fontSize: "10px",
          letterSpacing: "0.08em",
          backdropFilter: "blur(2px)",
        }}
      >
        QUEST: Route wallets to the right kingdom
      </div>
      <div
        className="hidden sm:block"
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 40,
          border: "1px solid rgba(134,239,172,0.45)",
          backgroundColor: "rgba(6,12,18,0.72)",
          borderRadius: "10px",
          padding: "8px 10px",
          color: "#d1fae5",
          fontFamily: "monospace",
          minWidth: "148px",
        }}
      >
        <div style={{ fontSize: "9px", color: "#86efac", letterSpacing: "0.1em", marginBottom: "4px" }}>MINIMAP</div>
        <div style={{ height: "44px", borderRadius: "6px", border: "1px solid #1f2937", background: "linear-gradient(180deg,#0f172a 0%, #1e293b 100%)", position: "relative" }}>
          <span style={{ position: "absolute", left: "10%", top: "38%", width: "7px", height: "7px", borderRadius: "2px", backgroundColor: VC.ALLOW.accent }} />
          <span style={{ position: "absolute", left: "48%", top: "15%", width: "7px", height: "7px", borderRadius: "2px", backgroundColor: VC.WARN.accent }} />
          <span style={{ position: "absolute", left: "82%", top: "38%", width: "7px", height: "7px", borderRadius: "2px", backgroundColor: VC.BLOCK.accent }} />
          <span style={{ position: "absolute", left: "48%", top: "72%", width: "5px", height: "5px", borderRadius: "999px", backgroundColor: "#60a5fa" }} />
        </div>
        <div style={{ marginTop: "4px", fontSize: "9px", color: "#93c5fd" }}>NPCs active: {total}</div>
      </div>
    </>
  );
}

// ================================================================
// Main page
// ================================================================
export default function MapPage() {
  const { publicKey, isConnected, isFreighterAvailable, displayName, connect, connectError } = useStellarWallet();
  const [npcs, setNPCs] = useState<NPC[]>([]);
  const [counts, setCounts] = useState<Record<Verdict, number>>({ ALLOW: 0, WARN: 0, BLOCK: 0 });
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
  const [form, setForm] = useState({ target: "", amount: "", action: "transfer" });
  const [checking, setChecking] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(true);
  const [thresholds, setThresholds] = useState<{ low: number; medium: number } | null>(null);
  const [stats, setStats] = useState<{ total: number; blocked: number; avgScore: number } | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hasError, setHasError] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(FLOW_STEPS.map(() => "idle"));
  const [stepDetails, setStepDetails] = useState<(string | undefined)[]>(FLOW_STEPS.map(() => undefined));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gateOpenLoad, setGateOpenLoad] = useState<Record<Verdict, number>>({ ALLOW: 0, WARN: 0, BLOCK: 0 });
  const [insideNpcs, setInsideNpcs] = useState<InsideNPC[]>([]);
  const counterRef = useRef(0);
  const activeStepRef = useRef(-1);

  const insideSlots: Record<Verdict, Array<{ x: number; y: number }>> = {
    ALLOW: [
      { x: CASTLE.ALLOW.x - 2, y: CASTLE.ALLOW.y - 3.8 },
      { x: CASTLE.ALLOW.x + 2, y: CASTLE.ALLOW.y - 3.2 },
      { x: CASTLE.ALLOW.x + 0.5, y: CASTLE.ALLOW.y - 5.2 },
    ],
    WARN: [
      { x: CASTLE.WARN.x - 2.5, y: CASTLE.WARN.y - 3.3 },
      { x: CASTLE.WARN.x + 2, y: CASTLE.WARN.y - 3.9 },
      { x: CASTLE.WARN.x + 0.2, y: CASTLE.WARN.y - 5.4 },
    ],
    BLOCK: [
      { x: CASTLE.BLOCK.x - 2, y: CASTLE.BLOCK.y - 3.8 },
      { x: CASTLE.BLOCK.x + 2.5, y: CASTLE.BLOCK.y - 3.4 },
      { x: CASTLE.BLOCK.x + 0.3, y: CASTLE.BLOCK.y - 5.2 },
    ],
  };

  const triggerGateInteraction = useCallback((id: string, verdict: Verdict) => {
    setNPCs((prev) => prev.map((n) => (n.id === id ? { ...n, phase: "arrived" as Phase } : n)));

    setTimeout(() => {
      setNPCs((prev) => prev.map((n) => (n.id === id ? { ...n, phase: "entering" as Phase } : n)));
      setGateOpenLoad((prev) => ({ ...prev, [verdict]: prev[verdict] + 1 }));

      const slotPool = insideSlots[verdict];
      const slot = slotPool[Math.floor(Math.random() * slotPool.length)];
      const insideId = `${id}-inside`;
      setInsideNpcs((prev) => [...prev, { id: insideId, verdict, address: id.slice(0, 8), x: slot.x, y: slot.y }]);

      // NPC disappears as it enters the gate
      setTimeout(() => {
        setNPCs((prev) => prev.filter((n) => !(n.id === id && !n.historic)));
      }, 520);

      // NPC inside the castle remains visible briefly
      setTimeout(() => {
        setInsideNpcs((prev) => prev.filter((n) => n.id !== insideId));
      }, 3200);

      // Door remains active for a short period to show open/close interaction
      setTimeout(() => {
        setGateOpenLoad((prev) => ({ ...prev, [verdict]: Math.max(0, prev[verdict] - 1) }));
      }, 2000);
    }, 320);
  }, []);

  const setStep = (i: number, status: StepStatus, detail?: string) => {
    activeStepRef.current = status === "active" ? i : activeStepRef.current;
    setStepStatuses((prev) => {
      const next = [...prev];
      next[i] = status;
      return next;
    });
    if (detail !== undefined) {
      setStepDetails((prev) => {
        const next = [...prev];
        next[i] = detail;
        return next;
      });
    }
  };

  const resetFlow = () => {
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));
    setResult(null);
    setHasError(false);
    activeStepRef.current = -1;
  };

  // ---- load history ----
  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then((data) => {
        const list: Array<{ id: number; target: string; verdict: Verdict; riskScore: number; reason?: string; timestamp: number }> =
          (data.assessments || []).slice(0, 15);
        setRecentAssessments(list);
        const c: Record<Verdict, number> = { ALLOW: 0, WARN: 0, BLOCK: 0 };
        const initial: NPC[] = list.map((a, i) => {
          c[a.verdict]++;
          return {
            id: `h${i}`,
            address: a.target,
            verdict: a.verdict,
            score: a.riskScore,
            reason: a.reason,
            timestamp: a.timestamp,
            phase: "arrived" as Phase,
            offsetX: randOff(12),
            offsetY: randOff(7),
            historic: true,
          };
        });
        setNPCs(initial);
        setCounts(c);
        setHistLoading(false);
      })
      .catch(() => setHistLoading(false));
  }, []);

  // ---- load policy + stats ----
  useEffect(() => {
    fetch("/api/thresholds")
      .then((r) => r.json())
      .then((data) => {
        if (data.low !== undefined && data.medium !== undefined) {
          setThresholds({ low: data.low, medium: data.medium });
        }
      })
      .catch(() => undefined);

    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats({
          total: Number(data.total || 0),
          blocked: Number(data.blocked || 0),
          avgScore: Number(data.avgScore || 0),
        });
      })
      .catch(() => undefined);
  }, []);

  // ---- check a wallet ----
  const checkWallet = useCallback(async () => {
    if (checking || !form.target.trim() || !form.amount) return;
    const address = form.target.trim();
    const amount = parseFloat(form.amount) || 0;
    const action = form.action;

    setChecking(true);
    setHasError(false);
    setResult(null);
    setStepStatuses(FLOW_STEPS.map(() => "idle"));
    setStepDetails(FLOW_STEPS.map(() => undefined));
    activeStepRef.current = -1;

    setForm((prev) => ({ ...prev, target: "" }));

    const id = `n${++counterRef.current}-${Date.now()}`;
    setSelectedId(id);

    // spawn NPC
    setNPCs((prev) => [
      ...prev,
      { id, address, phase: "checking", offsetX: 0, offsetY: 0, historic: false },
    ]);

    try {
      setStep(0, "active");
      await new Promise((r) => setTimeout(r, 500));
      const score = localScore(address, amount, action);
      setStep(0, "done", `Score: ${score}/100 for ${amount} XLM ${action}`);

      setStep(1, "active");
      await new Promise((r) => setTimeout(r, 350));
      const x402Res = await fetch(`/x402/verdict?score=${score}`);
      const got402 = x402Res.status === 402;
      setStep(1, "done", got402 ? "HTTP 402 - $0.001 USDC required" : "Access granted (demo mode)");

      setStep(2, "active");
      await new Promise((r) => setTimeout(r, 550));
      setStep(2, "done", got402 ? "USDC settled on Stellar in <5s" : "No payment needed in demo");

      setStep(3, "active");
      const vRes = await fetch(`/api/verdict?score=${score}`).then((r) => r.json());
      const verdict: Verdict = vRes.verdict ?? (score >= 70 ? "BLOCK" : score >= 30 ? "WARN" : "ALLOW");
      const reasons = buildReasons(amount, action, verdict);
      setStep(3, "done", `${verdict}: ${verdict === "ALLOW" ? "Safe" : verdict === "WARN" ? "Needs review" : "Blocked"}`);

      setCounts((prev) => ({ ...prev, [verdict]: prev[verdict] + 1 }));
      const offX = randOff(12);
      const offY = randOff(7);

      setNPCs((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                verdict,
                score,
                reason: reasons[0],
                phase: "marching" as Phase,
                offsetX: offX,
                offsetY: offY,
              }
            : n
        )
      );

      setStep(4, "active");
      let txHash: string | undefined;
      let explorerUrl: string | undefined;
      try {
        const deployer = "GDGNKYEEYQMFWHYXJA6NGM3573GDSOKQ3L6TTD2DERPELZFHZRDHHYCV";
        const assessRes = await fetch("/api/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: deployer,
            target: deployer,
            riskScore: score,
            verdict,
            reason: reasons[0],
          }),
        });
        const assessData = await assessRes.json();
        if (assessData.txHash) {
          txHash = assessData.txHash;
          explorerUrl = assessData.explorerUrl;
          setStep(4, "done", `Recorded on-chain - tx: ${assessData.txHash.slice(0, 10)}...`);
        } else {
          setStep(4, "done", `Attestation response: ${assessData.error || "no hash"}`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        setStep(4, "done", `Attestation failed: ${msg}`);
      }

      setResult({
        target: address,
        amount,
        action,
        verdict,
        score,
        reasons,
        txHash,
        explorerUrl,
      });

      setNPCs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, txHash, explorerUrl } : n))
      );

      setTimeout(() => {
        triggerGateInteraction(id, verdict);
      }, 2600);
    } catch {
      const active = activeStepRef.current;
      if (active >= 0) setStep(active, "error", "Execution failed");
      setHasError(true);
      const verdict: Verdict = "WARN";
      setCounts((prev) => ({ ...prev, WARN: prev.WARN + 1 }));
      setNPCs((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, verdict, score: 50, phase: "marching" as Phase, offsetX: 0, offsetY: 0 }
            : n
        )
      );
      setTimeout(() => {
        triggerGateInteraction(id, verdict);
      }, 2600);
    }

    setChecking(false);
  }, [checking, form, triggerGateInteraction]);

  // ---- compute NPC positions ----
  function getPos(npc: NPC) {
    if (!npc.verdict || npc.phase === "checking") return SPAWN;
    const base = CASTLE[npc.verdict];
    return { x: base.x + npc.offsetX * 0.8, y: base.y + npc.offsetY + GATE_OFFSET_Y };
  }
  function getInitPos(npc: NPC) {
    if (npc.historic && npc.verdict) {
      const base = CASTLE[npc.verdict];
      return { x: base.x + npc.offsetX * 0.8, y: base.y + npc.offsetY + GATE_OFFSET_Y };
    }
    return SPAWN;
  }

  const doorTraffic: Record<Verdict, { marching: number; arrived: number; entering: number; queued: number }> = {
    ALLOW: { marching: 0, arrived: 0, entering: 0, queued: 0 },
    WARN: { marching: 0, arrived: 0, entering: 0, queued: 0 },
    BLOCK: { marching: 0, arrived: 0, entering: 0, queued: 0 },
  };
  for (const npc of npcs) {
    if (!npc.verdict) continue;
    if (npc.phase === "marching") doorTraffic[npc.verdict].marching += 1;
    if (npc.phase === "arrived") doorTraffic[npc.verdict].arrived += 1;
    if (npc.phase === "entering") doorTraffic[npc.verdict].entering += 1;
    if (npc.phase === "marching" || npc.phase === "arrived") doorTraffic[npc.verdict].queued += 1;
  }

  const selected = selectedId ? npcs.find((n) => n.id === selectedId) : null;
  const verdictColor = result?.verdict === "ALLOW" ? "#166534" : result?.verdict === "WARN" ? "#854d0e" : "#dc2626";
  const verdictBg = result?.verdict === "ALLOW" ? "#f0fdf4" : result?.verdict === "WARN" ? "#fffbeb" : "#fef2f2";
  const verdictBorder = result?.verdict === "ALLOW" ? "#bbf7d0" : result?.verdict === "WARN" ? "#fde68a" : "#fecaca";
  const VerdictIcon = result?.verdict === "ALLOW" ? ShieldCheck : result?.verdict === "WARN" ? ShieldAlert : ShieldOff;
  const doneCount = stepStatuses.filter((s) => s === "done").length;

  return (
    <div style={{ backgroundColor: "#060d06", minHeight: "100dvh" }}>
      <div style={{ borderBottom: "1px solid #1a2e1a", padding: "10px 20px" }}>
        <div
          className="flex-wrap md:flex-nowrap"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.15em", color: "#4ade80" }}>
            ⚔ VERDICT ARENA
          </span>
          <span style={{ color: "#1a2e1a", fontFamily: "monospace" }}>|</span>
          <span className="hidden sm:inline" style={{ fontFamily: "monospace", fontSize: "10px", color: "#374040", letterSpacing: "0.1em" }}>
            SHIELDSTELLAR · STELLAR TESTNET
          </span>
          {isConnected && publicKey ? (
            <div
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "5px 9px",
                borderRadius: "999px",
                border: "1px solid #1f3a1f",
                backgroundColor: "#0a160a",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "999px", backgroundColor: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#86efac", letterSpacing: "0.08em" }}>
                {displayName}
              </span>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={!isFreighterAvailable}
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #1f3a1f",
                backgroundColor: isFreighterAvailable ? "#0f2510" : "#0a160a",
                color: isFreighterAvailable ? "#86efac" : "#6b7280",
                fontFamily: "monospace",
                fontSize: "10px",
                letterSpacing: "0.08em",
                cursor: isFreighterAvailable ? "pointer" : "not-allowed",
                transition: "all 0.2s ease",
              }}
            >
              {isFreighterAvailable ? "CONNECT FREIGHTER" : "INSTALL FREIGHTER"}
            </button>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {(["ALLOW", "WARN", "BLOCK"] as Verdict[]).map((v) => (
              <span
                key={v}
                style={{
                  fontFamily: "monospace",
                  fontSize: "9px",
                  color: VC[v].accent,
                  letterSpacing: "0.08em",
                }}
              >
                {counts[v]} {v}
              </span>
            ))}
          </div>
        </div>
        {connectError && (
          <div
            style={{
              marginTop: "8px",
              border: "1px solid #7f1d1d",
              backgroundColor: "#2c0a0a",
              color: "#fecaca",
              borderRadius: "8px",
              padding: "6px 8px",
              fontFamily: "monospace",
              fontSize: "10px",
              letterSpacing: "0.02em",
            }}
          >
            {connectError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr]" style={{ minHeight: "calc(100dvh - 56px)" }}>
        {/* ---- map ---- */}
        <div className="min-h-[calc(100dvh-56px)] lg:min-h-[clamp(360px,58vh,760px)]" style={{ position: "relative", borderRight: "1px solid #1a2e1a" }}>
        {/* background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(180deg, #081226 0%, #0b1b32 20%, #16351f 50%, #1f2a14 72%, #1f2937 100%)",
              "radial-gradient(ellipse 45% 22% at 50% 12%, rgba(125,211,252,0.14) 0%, transparent 74%)",
              "radial-gradient(ellipse 26% 18% at 13% 53%, rgba(74,222,128,0.2) 0%, transparent 75%)",
              "radial-gradient(ellipse 22% 16% at 50% 30%, rgba(251,191,36,0.16) 0%, transparent 74%)",
              "radial-gradient(ellipse 26% 18% at 84% 53%, rgba(248,113,113,0.2) 0%, transparent 75%)",
              `radial-gradient(ellipse 32% 38% at 13% 40%, ${VC.ALLOW.glow} 0%, transparent 70%)`,
              `radial-gradient(ellipse 32% 38% at 50% 16%, ${VC.WARN.glow} 0%, transparent 70%)`,
              `radial-gradient(ellipse 32% 38% at 84% 40%, ${VC.BLOCK.glow} 0%, transparent 70%)`,
              "radial-gradient(ellipse 18% 14% at 50% 72%, rgba(96,165,250,0.24) 0%, transparent 60%)",
            ].join(", "),
          }}
        />

        {/* atmosphere bands */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: [
              "radial-gradient(ellipse 60% 20% at 25% 22%, rgba(226,232,240,0.1) 0%, transparent 72%)",
              "radial-gradient(ellipse 58% 18% at 75% 28%, rgba(226,232,240,0.08) 0%, transparent 72%)",
            ].join(", "),
            backgroundSize: "220px 110px, 260px 120px",
            animation: "cloudDrift 28s linear infinite",
            opacity: 0.5,
          }}
        />

        {/* vignette for RPG depth */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.24) 100%)",
          }}
        />

        {/* SVG roads + terrain */}
        <TerrainSVG />
        <GameHud total={npcs.length} />

        {/* castles */}
        {(["ALLOW", "WARN", "BLOCK"] as Verdict[]).map((v) => {
          const pos = CASTLE[v];
          const C = VC[v];
          const traffic = doorTraffic[v];
          const gateOpen = gateOpenLoad[v] > 0 || traffic.entering > 0;
          return (
            <div
              key={v}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                zIndex: 10,
                userSelect: "none",
              }}
            >
              {/* glow halo */}
              <div
                style={{
                  position: "absolute",
                  inset: "-24px",
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${C.glow} 0%, transparent 70%)`,
                  animation: "haloPulse 3s ease-in-out infinite",
                  pointerEvents: "none",
                }}
              />

              {/* local environment ring around castle base */}
              <div
                style={{
                  position: "absolute",
                  width: "188px",
                  height: "68px",
                  left: "50%",
                  top: "84%",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "999px",
                  background: `radial-gradient(ellipse at center, ${C.glow} 0%, rgba(0,0,0,0) 72%)`,
                  border: `1px solid ${C.terrainStroke}`,
                  opacity: 0.35,
                  zIndex: -1,
                }}
              />

              <PixelCastle verdict={v} marchingCount={traffic.marching} gateOpen={gateOpen} />

              {(traffic.marching > 0 || traffic.arrived > 0 || gateOpen) && (
                <div
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "999px",
                    margin: "-18px auto 4px",
                    backgroundColor: C.accent,
                    boxShadow: `0 0 14px ${C.accent}`,
                    animation: "doorPulse 1s ease-in-out infinite",
                  }}
                />
              )}

              {/* castle name */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "9px",
                  letterSpacing: "0.15em",
                  color: C.accent,
                  marginTop: "3px",
                  textShadow: `0 0 10px ${C.accent}`,
                }}
              >
                {C.name}
              </div>

              {/* verdict pill */}
              <div
                style={{
                  display: "inline-block",
                  padding: "1px 7px",
                  borderRadius: "999px",
                  backgroundColor: C.badgeBg,
                  color: C.badgeFg,
                  fontSize: "8px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  letterSpacing: "0.12em",
                  marginTop: "2px",
                }}
              >
                {v}
              </div>

              {/* count bubble */}
              {counts[v] > 0 && (
                <div
                  style={{
                    marginTop: "3px",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    color: C.accent,
                    opacity: 0.8,
                  }}
                >
                  ×{counts[v]}
                </div>
              )}

              {traffic.queued > 0 && (
                <div
                  style={{
                    marginTop: "2px",
                    fontFamily: "monospace",
                    fontSize: "8px",
                    letterSpacing: "0.08em",
                    color: C.accent,
                    opacity: 0.85,
                  }}
                >
                  QUEUE {traffic.queued}
                </div>
              )}
            </div>
          );
        })}

        {/* NPCs visible inside castles after entry */}
        <AnimatePresence>
          {insideNpcs.map((npc) => {
            const color = VC[npc.verdict].accent;
            return (
              <motion.div
                key={npc.id}
                initial={{ left: `${npc.x}%`, top: `${npc.y}%`, opacity: 0, scale: 0.6 }}
                animate={{ left: `${npc.x}%`, top: `${npc.y}%`, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.35 }}
                style={{
                  position: "absolute",
                  transform: "translate(-50%, -100%)",
                  zIndex: 16,
                  pointerEvents: "none",
                }}
              >
                <motion.div
                  animate={{ y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                  style={{ textAlign: "center" }}
                >
                  <div style={{ width: "7px", height: "7px", borderRadius: "999px", margin: "0 auto", backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                  <div style={{ fontSize: "6px", fontFamily: "monospace", color, marginTop: "1px" }}>INSIDE</div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* spawn label */}
        <div
          style={{
            position: "absolute",
            left: `${SPAWN.x}%`,
            top: `${SPAWN.y + 5}%`,
            transform: "translateX(-50%)",
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#3b82f6",
            letterSpacing: "0.12em",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ▲ SCAN POINT
        </div>

        {/* NPCs */}
        <AnimatePresence>
          {npcs.map((npc) => {
            const pos = getPos(npc);
            const initPos = getInitPos(npc);
            const isChecking = npc.phase === "checking";
            const isMarching = npc.phase === "marching";
            const isEntering = npc.phase === "entering";
            const duration = isMarching ? 2.3 : 0;

            return (
              <motion.div
                key={npc.id}
                initial={{ left: `${initPos.x}%`, top: `${initPos.y}%`, opacity: 0, scale: 0 }}
                animate={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  opacity: isEntering ? 0 : 1,
                  scale: isEntering ? 0.25 : 1,
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  left: { duration, ease: "easeInOut" },
                  top:  { duration, ease: "easeInOut" },
                  opacity: { duration: isEntering ? 0.45 : 0.25 },
                  scale: { duration: isEntering ? 0.45 : 0.25 },
                }}
                style={{
                  position: "absolute",
                  transform: "translate(-50%, -100%)",
                  zIndex: 20,
                  cursor: "default",
                }}
                title={`${npc.address}${npc.score !== undefined ? ` · Score ${npc.score}` : ""}`}
              >
                {/* bounce shell while checking */}
                <motion.div
                  animate={
                    isChecking
                      ? { y: [0, -7, 0], scale: [1, 1.08, 1] }
                      : npc.phase === "arrived"
                        ? { y: [0, -2, 0], x: [0, 1, -1, 0] }
                        : { y: 0, x: 0 }
                  }
                  transition={
                    isChecking
                      ? { repeat: Infinity, duration: 0.55, ease: "easeInOut" }
                      : npc.phase === "arrived"
                        ? { repeat: Infinity, duration: 0.9, ease: "easeInOut" }
                        : { duration: 0 }
                  }
                  style={{ textAlign: "center" }}
                >
                  {isChecking && (
                    <div
                      style={{
                        fontSize: "9px",
                        fontFamily: "monospace",
                        color: "#60a5fa",
                        lineHeight: 1,
                        marginBottom: "2px",
                        textShadow: "0 0 6px #3b82f6",
                      }}
                    >
                      ?
                    </div>
                  )}
                  <NpcSprite verdict={npc.verdict} size={16} />
                  <div
                    style={{
                      width: "16px",
                      height: "2px",
                      margin: "1px auto 0",
                      borderRadius: "999px",
                      backgroundColor: npc.verdict ? VC[npc.verdict].accent : "#64748b",
                      opacity: 0.85,
                      boxShadow: npc.verdict ? `0 0 6px ${VC[npc.verdict].accent}` : "none",
                    }}
                  />
                  <div
                    style={{
                      fontSize: "6px",
                      fontFamily: "monospace",
                      color: npc.verdict ? VC[npc.verdict].accent : "#64748b",
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                      marginTop: "1px",
                    }}
                  >
                    {shortAddr(npc.address)}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* loading overlay */}
        {histLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.6)",
              zIndex: 50,
            }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: "#4ade80" }} />
          </div>
        )}

        <button
          className="lg:hidden"
          onClick={() => setSheetOpen((v) => !v)}
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 60,
            borderRadius: "999px",
            border: "1px solid #1f3a1f",
            backgroundColor: "#0a160a",
            color: "#86efac",
            fontFamily: "monospace",
            fontSize: "10px",
            letterSpacing: "0.08em",
            padding: "7px 12px",
          }}
        >
          {sheetOpen ? "HIDE PANEL" : "OPEN PANEL"}
        </button>
        </div>

        {/* ---- risk check panel ---- */}
        <div
          className={`lg:static fixed top-0 right-0 bottom-0 z-50 lg:z-auto w-[88vw] max-w-[380px] lg:w-auto lg:max-w-none transition-transform duration-300 ease-out ${sheetOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}
          style={{
            backgroundColor: "#040a04",
            padding: "14px 14px 18px",
            overflowY: "auto",
            borderLeft: "1px solid #1a2e1a",
          }}
        >
          <div className="lg:hidden" style={{ display: "flex", justifyContent: "center", paddingBottom: "8px" }}>
            <button
              onClick={() => setSheetOpen((v) => !v)}
              style={{
                width: "100%",
                maxWidth: "180px",
                borderRadius: "999px",
                border: "1px solid #1f3a1f",
                backgroundColor: "#0a160a",
                color: "#86efac",
                fontFamily: "monospace",
                fontSize: "10px",
                letterSpacing: "0.08em",
                padding: "6px 10px",
              }}
            >
              {sheetOpen ? "CLOSE PANEL" : "OPEN PANEL"}
            </button>
          </div>
          <div
            style={{
              border: "1px solid #163016",
              backgroundColor: "#081108",
              borderRadius: "12px",
              padding: "12px",
            }}
          >
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "10px" }}>
              RISK CHECK CONTROL
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <input
                value={form.target}
                onChange={(e) => setForm((prev) => ({ ...prev, target: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && checkWallet()}
                placeholder="TARGET: G..."
                disabled={checking}
                style={{
                  width: "100%",
                  backgroundColor: "#050a05",
                  border: "1px solid #1a2e1a",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#e2e8f0",
                }}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="AMOUNT XLM"
                  disabled={checking}
                  style={{
                    width: "100%",
                    backgroundColor: "#050a05",
                    border: "1px solid #1a2e1a",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#e2e8f0",
                  }}
                />
                <select
                  value={form.action}
                  onChange={(e) => setForm((prev) => ({ ...prev, action: e.target.value }))}
                  disabled={checking}
                  style={{
                    width: "100%",
                    backgroundColor: "#050a05",
                    border: "1px solid #1a2e1a",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#e2e8f0",
                  }}
                >
                  <option value="transfer">Transfer</option>
                  <option value="contract-call">Contract Call</option>
                  <option value="swap">Swap</option>
                  <option value="mint">Mint</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={checkWallet}
                  disabled={checking || !form.target.trim() || !form.amount}
                  style={{
                    flex: 1,
                    backgroundColor: checking ? "#183218" : "#166534",
                    border: "1px solid #15803d",
                    borderRadius: "8px",
                    padding: "9px 12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#4ade80",
                    cursor: checking || !form.target.trim() || !form.amount ? "not-allowed" : "pointer",
                    letterSpacing: "0.08em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    opacity: checking || !form.target.trim() || !form.amount ? 0.6 : 1,
                  }}
                >
                  {checking ? <><Loader2 size={13} className="animate-spin" /> SCANNING</> : "⚔ RUN RISK CHECK"}
                </button>
                <button
                  onClick={resetFlow}
                  style={{
                    backgroundColor: "#0a160a",
                    border: "1px solid #1a2e1a",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "#9ca3af",
                  }}
                >
                  RESET
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {(checking || result || hasError) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3"
                style={{
                  border: "1px solid #163016",
                  backgroundColor: "#081108",
                  borderRadius: "12px",
                  padding: "12px",
                }}
              >
                <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "10px" }}>
                  x402 FLOW TRACE
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {FLOW_STEPS.map((step, i) => {
                    const status = stepStatuses[i];
                    const Icon = step.icon;
                    const done = status === "done";
                    const active = status === "active";
                    return (
                      <div key={step.title} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          style={{
                            width: "25px",
                            height: "25px",
                            borderRadius: "7px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: done ? "#166534" : active ? "#132913" : "#0b160b",
                            border: "1px solid #1a2e1a",
                            flexShrink: 0,
                          }}
                        >
                          {active ? <Loader2 size={14} className="animate-spin" style={{ color: "#4ade80" }} /> : done ? <CheckCircle2 size={14} style={{ color: "#dcfce7" }} /> : <Icon size={14} style={{ color: "#6b7280" }} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "11px", color: done || active ? "#d1fae5" : "#6b7280" }}>{step.title}</div>
                          <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                            {stepDetails[i] || (active ? step.waiting : "...")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: "10px", height: "4px", borderRadius: "999px", backgroundColor: "#0b160b", overflow: "hidden" }}>
                  <motion.div
                    animate={{ width: `${(doneCount / FLOW_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                    style={{ height: "100%", backgroundColor: hasError ? "#dc2626" : "#22c55e" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3"
              style={{ border: `1px solid ${verdictBorder}`, backgroundColor: verdictBg, borderRadius: "12px", padding: "12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <VerdictIcon size={18} style={{ color: verdictColor }} />
                <div>
                  <div style={{ color: verdictColor, fontWeight: 700, fontSize: "14px" }}>
                    {result.verdict === "ALLOW" ? "Safe to proceed" : result.verdict === "WARN" ? "Needs human review" : "Transaction blocked"}
                  </div>
                  <div style={{ color: verdictColor, opacity: 0.7, fontSize: "11px", fontFamily: "monospace" }}>
                    Score {result.score}/100 - {result.amount} XLM - {result.action}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "4px" }}>
                {result.reasons.map((r, i) => (
                  <div key={`${r}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "999px", backgroundColor: verdictColor, marginTop: "6px", flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: verdictColor }}>{r}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "9px", paddingTop: "8px", borderTop: `1px solid ${verdictBorder}`, display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: "10px", color: verdictColor, opacity: 0.65 }}>
                <span>x402 cost: $0.001</span>
                <span>stellar:testnet</span>
              </div>

              {result.explorerUrl && (
                <a
                  href={result.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: "9px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 8px",
                    borderRadius: "8px",
                    border: `1px solid ${verdictBorder}`,
                    color: verdictColor,
                    fontFamily: "monospace",
                    fontSize: "11px",
                  }}
                >
                  <ExternalLink size={13} />
                  View on-chain attestation
                </a>
              )}
            </motion.div>
          )}

          <div
            className="mt-3"
            style={{ border: "1px solid #163016", backgroundColor: "#081108", borderRadius: "12px", padding: "10px" }}
          >
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "7px" }}>
              POLICY CASTLE RULES
            </div>
            {thresholds ? (
              <>
                <div style={{ height: "8px", borderRadius: "999px", overflow: "hidden", display: "flex", border: "1px solid #1a2e1a" }}>
                  <div style={{ width: `${thresholds.low}%`, backgroundColor: "rgba(74,222,128,0.75)" }} />
                  <div style={{ width: `${thresholds.medium - thresholds.low}%`, backgroundColor: "rgba(251,191,36,0.75)" }} />
                  <div style={{ width: `${100 - thresholds.medium}%`, backgroundColor: "rgba(248,113,113,0.75)" }} />
                </div>
                <div style={{ display: "grid", gap: "4px", marginTop: "8px", fontFamily: "monospace", fontSize: "10px" }}>
                  <div style={{ color: VC.ALLOW.accent }}>ALLOW: score &lt; {thresholds.low}</div>
                  <div style={{ color: VC.WARN.accent }}>WARN: {thresholds.low} - {thresholds.medium - 1}</div>
                  <div style={{ color: VC.BLOCK.accent }}>BLOCK: score ≥ {thresholds.medium}</div>
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#6b7280" }}>Policy not available</div>
            )}
          </div>

          <div
            className="mt-3"
            style={{ border: "1px solid #163016", backgroundColor: "#081108", borderRadius: "12px", padding: "10px" }}
          >
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "7px" }}>
              ARENA STATS
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div style={{ border: "1px solid #1a2e1a", borderRadius: "7px", padding: "7px", backgroundColor: "#070f07" }}>
                <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6b7280" }}>TOTAL</div>
                <div style={{ fontFamily: "monospace", fontSize: "16px", color: "#d1fae5", marginTop: "2px" }}>{stats?.total ?? "-"}</div>
              </div>
              <div style={{ border: "1px solid #1a2e1a", borderRadius: "7px", padding: "7px", backgroundColor: "#070f07" }}>
                <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6b7280" }}>BLOCKED</div>
                <div style={{ fontFamily: "monospace", fontSize: "16px", color: VC.BLOCK.accent, marginTop: "2px" }}>{stats?.blocked ?? "-"}</div>
              </div>
              <div style={{ border: "1px solid #1a2e1a", borderRadius: "7px", padding: "7px", backgroundColor: "#070f07" }}>
                <div style={{ fontFamily: "monospace", fontSize: "9px", color: "#6b7280" }}>AVG SCORE</div>
                <div style={{ fontFamily: "monospace", fontSize: "16px", color: "#d1fae5", marginTop: "2px" }}>{stats?.avgScore ?? "-"}</div>
              </div>
            </div>
          </div>

          <div
            className="mt-3"
            style={{ border: "1px solid #163016", backgroundColor: "#081108", borderRadius: "12px", padding: "10px" }}
          >
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "7px" }}>
              RECENT ASSESSMENTS
            </div>
            <div style={{ display: "grid", gap: "6px", maxHeight: "190px", overflowY: "auto" }}>
              {recentAssessments.length === 0 && (
                <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#6b7280" }}>No on-chain assessments yet</div>
              )}
              {recentAssessments.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid #1a2e1a",
                    borderRadius: "7px",
                    backgroundColor: "#070f07",
                    padding: "7px 8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", fontFamily: "monospace", fontSize: "10px" }}>
                    <span style={{ color: "#d1fae5" }}>{shortAddr(row.target)}</span>
                    <span style={{ color: VC[row.verdict].accent }}>{row.verdict}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "3px", fontFamily: "monospace", fontSize: "9px", color: "#6b7280" }}>
                    <span>score {row.riskScore}</span>
                    <span>{formatTime(row.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="mt-3"
            style={{ border: "1px solid #163016", backgroundColor: "#081108", borderRadius: "12px", padding: "10px" }}
          >
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#4ade80", letterSpacing: "0.12em", marginBottom: "6px" }}>
              NPC LOG
            </div>
            <div style={{ display: "grid", gap: "6px", maxHeight: "168px", overflowY: "auto" }}>
              {npcs.slice(-12).reverse().map((npc) => (
                <button
                  key={npc.id}
                  onClick={() => setSelectedId(npc.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderRadius: "7px",
                    border: selected?.id === npc.id ? "1px solid #22c55e" : "1px solid #1a2e1a",
                    backgroundColor: selected?.id === npc.id ? "#0d1c0d" : "#070f07",
                    padding: "6px 8px",
                    color: "#d1fae5",
                    fontFamily: "monospace",
                    fontSize: "10px",
                  }}
                >
                  <div>{shortAddr(npc.address)} {npc.verdict ? `- ${npc.verdict}` : "- CHECKING"}</div>
                  <div style={{ color: "#6b7280", marginTop: "2px" }}>{npc.reason || "Pending analysis"}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes haloPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.12); }
        }

        @keyframes doorPulse {
          0%, 100% { transform: scale(0.9); opacity: 0.45; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        @keyframes cloudDrift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-38px); }
        }
      `}</style>
    </div>
  );
}
