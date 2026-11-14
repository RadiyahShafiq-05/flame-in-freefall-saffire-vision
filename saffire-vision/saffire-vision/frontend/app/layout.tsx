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
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:text-accent">
          Skip to main content
        </a>
        <DatasetProvider>
          <TopBar />
          <div className="flex">
            <Sidebar />
            <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 flex-col">
              <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-7 focus:outline-none">{children}</main>
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
