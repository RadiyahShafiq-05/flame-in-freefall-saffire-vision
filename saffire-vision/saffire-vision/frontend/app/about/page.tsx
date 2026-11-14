import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { SAFFIRE_I } from "@/lib/expectedDataset";

const RULES = [
  "Every number on screen comes from the backend or from NASA metadata.",
  "No camera matrix or distortion coefficient is shown unless a calibration actually succeeded.",
  "Color and monochrome copies, and combined composites, are not treated as independent calibration views.",
  "A detected sub-pattern (for example 6×4) is a partial region, not the true grid size.",
  "The distortion-grid images contain no flame data; nothing here predicts fire behaviour.",
];

export default function About() {
  return (
    <div className="space-y-6">
      <PageHeader title="About the project"
        subtitle="Flame in Freefall is a NASA Space Apps Challenge 2026 project. SAFFIRE Vision is its first module." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Purpose">
          <p className="text-sm leading-relaxed text-muted">
            The challenge asks for a dashboard that makes decades of NASA microgravity combustion results easier to find,
            compare and interpret for spacecraft and habitat fire safety. Measurements from experiment video depend on
            knowing how each camera distorts the image, so this module starts there, with the SAFFIRE-1 distortion grids.
          </p>
        </Card>
        <Card title="How we handle data">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">{RULES.map(r => <li key={r}>{r}</li>)}</ul>
        </Card>
        <Card title="Data source">
          <p className="text-sm leading-relaxed text-muted">
            {SAFFIRE_I.title}, {SAFFIRE_I.accession}, NASA Physical Sciences Informatics.
            DOI <a className="link font-mono" href={`https://doi.org/${SAFFIRE_I.doi}`} target="_blank" rel="noreferrer">{SAFFIRE_I.doi}</a>,
            licensed CC0-1.0.
          </p>
        </Card>
        <Card title="Links">
          <ul className="space-y-1.5 text-sm">
            <li><a className="link" href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" target="_blank" rel="noreferrer">Challenge: Flame in Freefall</a></li>
            <li><a className="link" href={SAFFIRE_I.psiUrl} target="_blank" rel="noreferrer">SAFFIRE-I on NASA PSI</a></li>
            <li><a className="link" href="https://github.com/RadiyahShafiq-05/flame-in-freefall-saffire-vision" target="_blank" rel="noreferrer">Project repository</a></li>
          </ul>
        </Card>
      </div>
      <p className="text-xs text-faint">Independent project, not affiliated with or endorsed by NASA.</p>
    </div>
  );
}
