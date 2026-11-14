import "./globals.css";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
export const metadata = { title: "SAFFIRE Vision", description: "Microgravity experiment image calibration & analysis (not NASA-endorsed)" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><Navbar /><div className="flex min-h-[calc(100vh-3rem)]"><Sidebar /><main className="flex-1 p-6 max-w-6xl">{children}</main></div></body></html>);
}
