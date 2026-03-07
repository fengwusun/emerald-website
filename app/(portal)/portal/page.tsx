import Link from "next/link";

export default function PortalHomePage() {
  return (
    <div className="grid">
      <h1>EMERALD+DIVER Team Portal</h1>
      <section className="card">
        <p>
          Use the portal to search cross-program targets and inspect per-object
          metadata plus ancillary previews.
        </p>
        <p><Link href="/portal/targets">Go to Target Catalog</Link></p>
      </section>
    </div>
  );
}
