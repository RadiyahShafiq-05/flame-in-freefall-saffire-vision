import Link from "next/link";
const items = [["/", "Home"], ["/dashboard", "Dashboard"], ["/dataset", "Dataset Explorer"], ["/analysis", "Image Analysis"], ["/calibration", "Calibration"], ["/reports", "Reports"]];
export default function Sidebar() {
  return (<nav className="w-52 border-r border-edge bg-panel p-4 space-y-1">{items.map(([h, l]) => (
    <Link key={h} href={h} className="block rounded px-3 py-2 text-sm text-gray-300 hover:bg-accent/10 hover:text-accent">{l}</Link>))}</nav>);
}
