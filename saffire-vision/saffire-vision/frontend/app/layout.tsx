import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import { DatasetProvider } from "@/lib/useDataset";

// next/font self-hosts the files at build time, so viewers' browsers never contact Google.
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "Flame in Freefall · SAFFIRE Vision",
  description: "Microgravity experiment image calibration and analysis. Independent project, not endorsed by NASA.",
};

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <DatasetProvider>
          <TopBar />
          <div className="flex">
            <Sidebar />
            <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 flex-col">
              <main className="w-full max-w-7xl flex-1 px-8 py-7">{children}</main>
              <footer className="border-t border-edge px-8 py-4 text-xs text-faint">
                Independent project. Not endorsed by NASA. Data: NASA Physical Sciences Informatics (PSI).
              </footer>
            </div>
          </div>
        </DatasetProvider>
      </body>
    </html>
  );
}
