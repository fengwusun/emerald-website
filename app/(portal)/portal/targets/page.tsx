import { PortalTargetCatalog } from "@/components/portal-target-catalog";
import { withBasePath } from "@/lib/base-path";

export default function PortalTargetsPage() {
  return (
    <div className="grid">
      <h1>Target Catalog</h1>
      <p className="muted" style={{ margin: "0.1rem 0" }}>
        Search and filter EMERALD+DIVER targets. Click a target to inspect
        ancillary data products.
      </p>
      <p className="muted" style={{ margin: "0.1rem 0 0.35rem 0" }}>
        Need shutter footprints?{" "}
        <a href={withBasePath("/fitsmap/index.html")} target="_blank" rel="noreferrer">
          Open FitsMap
        </a>
        .
      </p>
      <PortalTargetCatalog />
    </div>
  );
}
