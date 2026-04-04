import { cn } from "@/lib/utils";

type Verdict = "ALLOW" | "WARN" | "BLOCK";

const inlineStyles: Record<Verdict, React.CSSProperties> = {
  ALLOW: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "none",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
  },
  WARN: {
    backgroundColor: "#fef9c3",
    color: "#854d0e",
    border: "none",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
  },
  BLOCK: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    border: "none",
    borderRadius: "999px",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
  },
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
        "inline-flex items-center tracking-wider",
        className,
      )}
      style={inlineStyles[verdict]}
    >
      {verdict}
    </span>
  );
}
