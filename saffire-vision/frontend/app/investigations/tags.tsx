import { AREA_LABEL, VARIABLE_LABEL, type Area, type Variable } from "@/lib/investigations";

const AREA_CLASS: Record<Area, string> = {
  flammability: "border-warn/40 bg-warn/10 text-warn",
  detection: "border-accent-2/40 bg-accent-2/10 text-accent-2",
  suppression: "border-ok/40 bg-ok/10 text-ok",
};

export function AreaTag({ area }: { area: Area }) {
  return <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${AREA_CLASS[area]}`}>{AREA_LABEL[area]}</span>;
}

export function VariableTag({ variable }: { variable: Variable }) {
  return <span className="inline-block whitespace-nowrap rounded border border-accent/30 px-1.5 py-0.5 text-xs text-accent">{VARIABLE_LABEL[variable]}</span>;
}
