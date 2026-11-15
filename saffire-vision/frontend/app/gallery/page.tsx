import DistortionGallery from "@/components/DistortionGallery";

export const metadata = { title: "Distortion grids · SAFFIRE Vision" };

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">SAFFIRE-1 distortion grids</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Browse the calibration grid images from NASA&apos;s Spacecraft Fire Experiment-1. Search, filter and open each image to see its details.
        </p>
      </header>

      <section aria-labelledby="ds-h" className="rounded-md border border-edge bg-panel">
        <h2 id="ds-h" className="border-b border-edge px-4 py-3 text-lg font-semibold text-ink">Dataset information</h2>
        <dl className="grid gap-px bg-edge sm:grid-cols-2 [&>div]:bg-panel [&>div]:p-4">
          <div><dt className="text-xs font-medium text-muted">Dataset name</dt><dd className="text-sm text-ink">SAFFIRE-1 distortion-grid images</dd></div>
          <div><dt className="text-xs font-medium text-muted">NASA experiment reference</dt>
            <dd className="text-sm text-ink">Spacecraft Fire Experiment-1 (Saffire-1), flown on a Cygnus cargo vehicle in 2016.
              {/* TODO: add the official NASA source link once confirmed */}</dd></div>
          <div><dt className="text-xs font-medium text-muted">Current dataset status</dt>
            <dd className="text-sm text-ink"></dd></div>
          <div><dt className="text-xs font-medium text-muted">What distortion grids are used for</dt>
            <dd className="text-sm text-ink">A distortion grid is a picture of a pattern with known, evenly spaced lines. Any bending or stretching in the picture shows how the camera lens distorts the scene, so researchers can correct fire images and take accurate measurements from them.</dd></div>
        </dl>
      </section>

      <DistortionGallery />
    </div>
  );
}
