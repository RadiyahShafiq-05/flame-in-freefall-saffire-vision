export default function Notice({ tone = "info", title, children }:
  { tone?: "info" | "warn"; title: string; children?: React.ReactNode }) {
  const cls = tone === "warn" ? "border-warn/40 bg-warn/5" : "border-accent-2/40 bg-accent-2/5";
  const head = tone === "warn" ? "text-warn" : "text-accent-2";
  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      <p className={`font-medium ${head}`}>{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}
