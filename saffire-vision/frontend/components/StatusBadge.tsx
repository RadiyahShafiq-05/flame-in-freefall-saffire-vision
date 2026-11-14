export type Status = "completed" | "partial" | "in_progress" | "pending" | "not_tracked" | "failed";

const STYLE: Record<Status, { label: string; cls: string; dot: string }> = {
  completed: { label: "Completed", cls: "border-ok/40 text-ok", dot: "bg-ok" },
  partial: { label: "Partial", cls: "border-accent/40 text-accent", dot: "bg-accent/60 ring-1 ring-accent" },
  in_progress: { label: "In progress", cls: "border-accent/40 text-accent", dot: "bg-accent" },
  pending: { label: "Pending", cls: "border-edge text-muted", dot: "bg-faint" },
  not_tracked: { label: "Not tracked", cls: "border-dashed border-edge text-faint", dot: "bg-transparent border border-faint" },
  failed: { label: "Blocked", cls: "border-warn/40 text-warn", dot: "bg-warn" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
