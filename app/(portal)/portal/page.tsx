import Link from "next/link";
import { withBasePath } from "@/lib/base-path";

export default function PortalHomePage() {
  return (
    <div className="grid">
      <h1>EMERALD+DIVER Team Portal</h1>
      <section className="card">
        <p>
          Use the portal to search cross-program targets and inspect per-object
          metadata plus ancillary previews.
        </p>
        <p style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", margin: 0 }}>
          <Link href={withBasePath("/portal/targets")}>Go to Target Catalog</Link>
          <a href={withBasePath("/api/targets/catalog/download")}>Download Latest Target Catalog (CSV)</a>
        </p>
      </section>
    </div>
  );
}
