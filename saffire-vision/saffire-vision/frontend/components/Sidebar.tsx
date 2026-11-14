"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, type NavItem } from "@/lib/nav";

function Item({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active
        ? "bg-accent/10 font-medium text-accent"
        : "text-muted hover:bg-raised hover:text-ink"}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  return (
    <nav aria-label="Main" className="sticky top-14 h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-edge bg-panel px-3 py-4">
      <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-faint">SAFFIRE Vision</p>
      <div className="space-y-0.5">{NAV.filter(n => n.group === "module").map(n => <Item key={n.href} item={n} active={isActive(n.href)} />)}</div>
      <p className="mt-6 border-t border-edge px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wider text-faint">Project</p>
      <div className="space-y-0.5">{NAV.filter(n => n.group === "context").map(n => <Item key={n.href} item={n} active={isActive(n.href)} />)}</div>
    </nav>
  );
}
