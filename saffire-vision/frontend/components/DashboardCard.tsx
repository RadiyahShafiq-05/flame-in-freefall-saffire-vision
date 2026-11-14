export default function DashboardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="rounded-lg border border-edge bg-panel p-4"><h2 className="mb-2 text-sm font-medium text-accent">{title}</h2>{children}</section>);
}
