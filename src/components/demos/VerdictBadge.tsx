import { cn } from "@/lib/utils";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

const styles: Record<Verdict, string> = {
  ALLOW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  WARN: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  BLOCK: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Verdict;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold border tracking-wider",
        styles[verdict],
        className,
      )}
    >
      {verdict}
    </span>
  );
}
