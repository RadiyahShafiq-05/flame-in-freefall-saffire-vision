"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Dataset } from "@/types";

export type DatasetState = "loading" | "live" | "empty" | "offline";
interface Value { state: DatasetState; dataset: Dataset | null; error: string; refresh: () => void }

const Ctx = createContext<Value | null>(null);

// One dataset request shared by the top bar and every page, so they never disagree about status.
export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [state, setState] = useState<DatasetState>("loading");
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    setState("loading");
    api.dataset()
      .then(d => { setDataset(d); setError(""); setState(d.count ? "live" : "empty"); })
      .catch(e => { setDataset(null); setError(e.message); setState("offline"); });
  }, []);
  useEffect(refresh, [refresh]);
  return <Ctx.Provider value={{ state, dataset, error, refresh }}>{children}</Ctx.Provider>;
}

export function useDataset() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDataset must be used inside DatasetProvider");
  return v;
}
