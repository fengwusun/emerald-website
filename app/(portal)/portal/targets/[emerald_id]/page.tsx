import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { withBasePath, withBasePathForApiUrl } from "@/lib/base-path";
import { getTargetById } from "@/lib/data";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";

function isImageAssetPath(pathname: string): boolean {
  return /\.(png|jpg|jpeg)(\?|$)/i.test(pathname);
}

export default async function TargetDetailPage({
  params
}: {
  params: Promise<{ emerald_id: string }>;
}) {
  const { emerald_id } = await params;
  const target = getTargetById(emerald_id);

  if (!target) {
    notFound();
  }

  const jadesIdMatch = target.name.match(/^JADES-(\d+)$/);
  const jadesNumericId = jadesIdMatch ? jadesIdMatch[1] : null;
  const quickTags = getQuickTagsForTarget(target);
  const emissionLineTags = getEmissionLineTagsForTarget(target);
  const observationModes =
    target.observation_modes.length > 0
      ? target.observation_modes
      : target.instruments.map((instrument) => ({ instrument, status: target.status }));

  return (
    <div className="grid">
      <p>
        <Link href="/portal/targets">← Back to catalog</Link>
      </p>
      <h1>{target.name}</h1>
      <p className="muted">{target.emerald_id}</p>
      <section className="card">
        <p>
          <strong>Name:</strong> {target.name}
        </p>
        <p>
          <strong>Coordinates:</strong> RA {target.ra} | Dec {target.dec}
        </p>
        <p>
          <strong>z_spec:</strong> {Math.abs(target.z_spec - 1) < 1e-9 ? -1 : target.z_spec}
        </p>
        <p>
          <strong>JADES FitsMap:</strong>{" "}
          <a
            href={`https://jades.idies.jhu.edu/goods-n/?ra=${target.ra}&dec=${target.dec}&zoom=11`}
            target="_blank"
            rel="noreferrer"
          >
            Open source in GOODS-N FitsMap
          </a>
        </p>
        <p>
          <strong>JADES EAZY SED:</strong>{" "}
          {jadesNumericId ? (
            <a
              href={`https://jades.idies.jhu.edu/goods-n/goodsn_eazy_seds_v10e1/${jadesNumericId}_EAZY_SED.png`}
              target="_blank"
              rel="noreferrer"
            >
              Open SED plot
            </a>
          ) : (
            <span className="muted">Unavailable</span>
          )}
        </p>
        <div>
          <strong>Observation modes / Priority:</strong> {target.priority}
          <div style={{ marginTop: "0.45rem", display: "grid", gap: "0.35rem" }}>
            {observationModes.length > 0 ? (
              observationModes.map((mode) => (
                <div key={`${mode.instrument}-${mode.status}`} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span className="tag">{mode.instrument}</span>
                  <span className="tag">{mode.status}</span>
                </div>
              ))
            ) : (
              <span className="muted">Not labeled</span>
            )}
          </div>
        </div>
        <p>
          <strong>JWST Program:</strong> {target.jwst_program_id}
        </p>
        <p>
          <strong>Notes:</strong> {target.notes || "None"}
        </p>
        <p>
          <strong>Quick tags:</strong> {quickTags.length > 0 ? quickTags.join(", ") : "None"}
        </p>
        <p>
          <strong>Emission line tags:</strong>{" "}
          {emissionLineTags.length > 0 ? emissionLineTags.join(", ") : "None in VI table"}
        </p>
      </section>

      <section className="card">
        <h2>Ancillary Assets</h2>
        {target.ancillary_assets.length === 0 ? (
          <p className="muted">No ancillary assets registered for this target.</p>
        ) : (
          <div className="grid">
            {target.ancillary_assets.map((asset) => (
              <article key={`${asset.asset_type}-${asset.storage_key}`} className="card">
                <p>
                  <span className="tag">{asset.asset_type}</span> {asset.label}
                </p>
                <p className="muted">Storage key: {asset.storage_key}</p>
                {asset.preview_url ? (
                  <div className="grid">
                    <p>
                      <a href={withBasePathForApiUrl(asset.preview_url)} target="_blank" rel="noreferrer">
                        {/\.fits$/i.test(asset.storage_key) ? "Download FITS" : "Preview"}
                      </a>
                    </p>
                    {(asset.asset_type === "image" ||
                      (asset.asset_type === "spectrum" &&
                        asset.preview_url &&
                        isImageAssetPath(asset.preview_url))) ? (
                      <Image
                        src={withBasePathForApiUrl(asset.preview_url)}
                        alt={`${target.emerald_id} ${asset.label}`}
                        width={520}
                        height={520}
                        unoptimized
                        style={{ width: "100%", maxWidth: "520px", height: "auto", borderRadius: "8px", border: "1px solid #d8e0e3" }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <form method="post" action={withBasePath("/api/portal/logout")}>
        <button type="submit" className="secondary">
          Sign out portal session
        </button>
      </form>
    </div>
  );
}
