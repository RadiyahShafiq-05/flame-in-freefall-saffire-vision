// level 2 for a card that is a page section on its own, 3 for a card grouped under a section heading.
export default function Card({ title, level = 2, action, className = "", children }:
  { title?: string; level?: 2 | 3; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={`rounded-lg border border-edge bg-panel p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <Heading className={`font-semibold text-ink ${level === 2 ? "text-base" : "text-sm"}`}>{title}</Heading>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
