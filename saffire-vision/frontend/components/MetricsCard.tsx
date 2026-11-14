export default function MetricsCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (<div className="rounded-lg border border-edge bg-panel p-4"><div className="text-xs uppercase text-gray-400">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-accent">{value}</div>{hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}</div>);
}
