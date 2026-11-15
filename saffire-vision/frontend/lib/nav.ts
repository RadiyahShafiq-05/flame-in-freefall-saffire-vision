export interface NavItem { href: string; label: string; icon: string; group: "module" | "context" }

// Icon values are SVG path data (24x24, stroked) so the sidebar needs no icon dependency.
export const NAV: NavItem[] = [
  { href: "/", label: "Overview", group: "module", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/dataset", label: "Dataset Explorer", group: "module", icon: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4" },
  { href: "/analysis", label: "Image Analysis", group: "module", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
  { href: "/flame", label: "Flame Frames", group: "module", icon: "M12 3c2 3 4 5 4 8a4 4 0 11-8 0c0-1.5.7-2.8 1.4-4 .4 1.4 1.2 2.2 2.6 2.2C11.2 6.5 11.6 4.8 12 3z" },
  { href: "/calibration", label: "Camera Calibration", group: "module", icon: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z" },
  { href: "/reports", label: "Reports", group: "module", icon: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { href: "/insights", label: "Fire Safety Insights", group: "context", icon: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM9 12l2 2 4-4" },
  { href: "/investigations", label: "Combustion Investigations", group: "context", icon: "M12 3c3 4 5 6.5 5 10a5 5 0 01-10 0c0-2 1-3.5 2-5 .5 2 1.5 3 3 3-1-3-.5-5.5 0-8z" },
  { href: "/research", label: "Research Assistant", group: "context", icon: "M4 5h16v11H4zM8 20h8M12 16v4M7 9h10M7 12h6" },
  { href: "/about", label: "About Project", group: "context", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01" },
  { href: "/gallery", label: "Distortion grids", group: "module",
  icon: "M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18" },
];

export function pageTitle(pathname: string) {
  const item = NAV.find(n => n.href === pathname) ?? NAV.filter(n => n.href !== "/").find(n => pathname.startsWith(n.href));
  return item?.label ?? "Overview";
}
