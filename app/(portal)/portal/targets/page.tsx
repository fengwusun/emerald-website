import { PortalTargetTable } from "@/components/portal-target-table";
import { loadTargets } from "@/lib/data";

export default function PortalTargetsPage() {
  const targets = loadTargets();

  return (
    <div className="grid">
      <h1>Target Catalog</h1>
      <p className="muted">
        Search and filter EMERALD targets. Click a target to inspect ancillary
        data products.
      </p>
      <PortalTargetTable targets={targets} />
    </div>
  );
}
