import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { SAFFIRE_I } from "@/lib/expectedDataset";

const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";

const RULES = [
  "Every number on screen comes from the backend or from NASA metadata.",
  "No camera matrix or distortion coefficient is shown unless a calibration actually succeeded.",
  "Color and monochrome copies, and combined composites, are not treated as independent calibration views.",
  "A detected sub-pattern (for example 6×4) is a partial region, not the true grid size.",
  "The distortion-grid images contain no flame data. Fire Safety Insights restate PSI records, and Flame Frames reports pixel area only. Neither predicts fire behaviour.",
];

export default function About() {
  return (
    <div className="space-y-8">
      <PageHeader title="About the project"
        subtitle="Flame in Freefall is a NASA Space Apps Challenge 2026 project. SAFFIRE Vision is its first module." />

      <section id="why" aria-labelledby="why-h" className="space-y-3 scroll-mt-20">
        <h2 id="why-h" className="text-base font-semibold text-ink">Why this matters</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Microgravity combustion" level={3}>
            <p className="text-sm leading-relaxed text-muted">
              Without buoyancy, flames lose their rising plume and spread differently, so fire-safety rules based on Earth
              tests can be wrong in a spacecraft. The challenge brief expects planned Moon habitats to run at 30% oxygen or
              more, which makes materials more flammable.{" "}
              <a className="link" href={CHALLENGE_URL} target="_blank" rel="noreferrer">Source: challenge brief (opens in new tab)</a>
            </p>
          </Card>
          <Card title="Camera geometry" level={3}>
            <p className="text-sm leading-relaxed text-muted">
              Flame size and spread rate are measured from experiment video. Lens distortion bends straight lines, so those
              measurements are only as reliable as the camera calibration behind them.
            </p>
          </Card>
          <Card title="Where this module fits" level={3}>
            <p className="text-sm leading-relaxed text-muted">
              SAFFIRE Vision checks the SAFFIRE-1 camera grids, lists the PSI combustion investigations and their test
              conditions, and shows a fire-safety reading of each record. Flame Frames marks flame-colored pixels in an
              uploaded still. Those marks are approximate, and the insights are not measured burn results.
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="project-h" className="space-y-3">
        <h2 id="project-h" className="text-base font-semibold text-ink">The project</h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card title="Purpose" level={3}>
            <p className="text-sm leading-relaxed text-muted">
              The challenge asks for a dashboard that makes decades of NASA microgravity combustion results easier to find,
              compare and interpret for spacecraft and habitat fire safety. Measurements from experiment video depend on
              knowing how each camera distorts the image. This app starts with the SAFFIRE-1 distortion grids, then adds
              the PSI investigation catalogue, a fire-safety reading of each record, and an approximate flame-region check.
            </p>
          </Card>
          <Card title="How we handle data" level={3}>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">{RULES.map(r => <li key={r}>{r}</li>)}</ul>
          </Card>
          <Card title="Data source" level={3}>
            <p className="text-sm leading-relaxed text-muted">
              {SAFFIRE_I.title}, {SAFFIRE_I.accession}, NASA Physical Sciences Informatics.
              DOI <a className="link font-mono" href={`https://doi.org/${SAFFIRE_I.doi}`} target="_blank" rel="noreferrer">{SAFFIRE_I.doi}</a>,
              licensed CC0-1.0.
            </p>
          </Card>
          <Card title="Links" level={3}>
            <ul className="space-y-1.5 text-sm">
              <li><a className="link" href={CHALLENGE_URL} target="_blank" rel="noreferrer">Challenge: Flame in Freefall</a></li>
              <li><a className="link" href={SAFFIRE_I.psiUrl} target="_blank" rel="noreferrer">SAFFIRE-I on NASA PSI</a></li>
              <li><a className="link" href="https://github.com/RadiyahShafiq-05/flame-in-freefall-saffire-vision" target="_blank" rel="noreferrer">Project repository</a></li>
            </ul>
            <p className="mt-3 text-xs text-faint">External links open in a new tab.</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
