import Link from "next/link";
export default function Home() {
  return (<div className="space-y-4"><h1 className="text-3xl font-semibold">SAFFIRE Vision</h1>
    <p className="text-gray-300">Microgravity experiment image calibration &amp; analysis platform — part of <em>Flame in Freefall</em>.</p>
    <p className="text-sm text-gray-400">Processes NASA SAFFIRE camera distortion-grid images. These are not flame or temperature data; no fire-behaviour conclusions are drawn.</p>
    <Link href="/dashboard" className="btn inline-block">Open dashboard</Link></div>);
}
