"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pageTitle } from "@/lib/nav";
import { useDataset } from "@/lib/useDataset";

// Concentric rings: a spherical flame, the shape flames take in microgravity.
function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="#3b82f6" strokeWidth="2" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.85" />
      <circle cx="16" cy="16" r="3.5" fill="#e6edf7" />
    </svg>
  );
}

function DatasetStatus() {
  const { state, dataset, refresh } = useDataset();
  const view = {
    loading: { dot: "bg-faint animate-pulse", text: "Checking backend…" },
    live: { dot: "bg-ok", text: `Backend live · ${dataset?.count} image${dataset?.count === 1 ? "" : "s"} loaded` },
    empty: { dot: "bg-warn", text: "Backend live · no images in data/raw" },
    offline: { dot: "bg-bad", text: "Backend offline · showing expected dataset" },
  }[state];
  return (
    <button onClick={refresh} title="Check again"
      className="flex items-center gap-2 rounded-full border border-edge bg-base px-3 py-1 text-xs text-muted hover:border-accent/40 hover:text-ink">
      <span className={`h-2 w-2 rounded-full ${view.dot}`} />
      {view.text}
    </button>
  );
}

export default function TopBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-edge bg-panel/95 px-5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-ink">Flame in Freefall</span>
          <span className="block text-[11px] text-faint">SAFFIRE Vision</span>
        </span>
      </Link>
      <span className="h-6 w-px bg-edge" aria-hidden />
      <span className="text-sm font-medium text-muted">{pageTitle(path)}</span>
      <div className="ml-auto"><DatasetStatus /></div>
    </header>
  );
}
