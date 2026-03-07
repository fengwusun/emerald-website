import { Suspense } from "react";
import { PortalTargetTable } from "@/components/portal-target-table";
import { loadTargets } from "@/lib/data";
import { withBasePath } from "@/lib/base-path";

export default function PortalTargetsPage() {
  const targets = loadTargets();

  return (
    <div className="grid">
      <h1>Target Catalog</h1>
      <p className="muted">
        Search and filter EMERALD+DIVER targets. Click a target to inspect
        ancillary data products.
      </p>
      <p className="muted">
        Need shutter footprints?{" "}
        <a href={withBasePath("/fitsmap/index.html")} target="_blank" rel="noreferrer">
          Open FitsMap
        </a>
        .
      </p>
      <Suspense fallback={<p className="muted">Loading target catalog...</p>}>
        <PortalTargetTable targets={targets} />
      </Suspense>
    </div>
  );
}
