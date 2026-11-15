import DistortionGallery from "@/components/DistortionGallery";
import PageHeader from "@/components/PageHeader";
import { SAFFIRE_I } from "@/lib/expectedDataset";

export const metadata = { title: "Distortion grids · SAFFIRE Vision" };

export default function GalleryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="SAFFIRE-1 distortion grids"
        subtitle="Browse the calibration grid images from NASA's Spacecraft Fire Safety Experiment-I. Search, filter and open each image to see its details." />

      <section aria-labelledby="ds-h" className="rounded-md border border-edge bg-panel">
        <h2 id="ds-h" className="border-b border-edge px-4 py-3 text-lg font-semibold text-ink">Dataset information</h2>
        <dl className="grid gap-px bg-edge sm:grid-cols-3 [&>div]:bg-panel [&>div]:p-4">
          <div><dt className="text-xs font-medium text-muted">Dataset name</dt><dd className="text-sm text-ink">SAFFIRE-1 distortion-grid images</dd></div>
          <div><dt className="text-xs font-medium text-muted">NASA experiment reference</dt>
            <dd className="text-sm text-ink">Spacecraft Fire Safety Experiment-I:{" "}
              <a className="link" href={SAFFIRE_I.psiUrl} target="_blank" rel="noreferrer">PSI-98 on NASA PSI</a>, DOI{" "}
              <a className="link" href={`https://doi.org/${SAFFIRE_I.doi}`} target="_blank" rel="noreferrer">{SAFFIRE_I.doi}</a></dd></div>
          <div><dt className="text-xs font-medium text-muted">What distortion grids are used for</dt>
            <dd className="text-sm text-ink">A distortion grid is a picture of a pattern with known, evenly spaced lines. Any bending or stretching in the picture shows how the camera lens distorts the scene, so researchers can correct fire images and take accurate measurements from them.</dd></div>
        </dl>
      </section>

      <DistortionGallery />
    </div>
  );
}
