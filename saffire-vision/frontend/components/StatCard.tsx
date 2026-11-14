export default function StatCard({ label, value, hint, source }:
  { label: string; value: React.ReactNode; hint?: React.ReactNode; source?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-edge bg-panel p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-2 text-lg font-semibold leading-snug text-ink">{value}</div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
      {source && <div className="mt-auto pt-3 text-xs text-faint">{source}</div>}
    </div>
  );
}
