export default function EmptyState({ title, body, action }: { title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-edge px-4 py-5 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {body && <p className="mt-1 text-xs text-faint">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
