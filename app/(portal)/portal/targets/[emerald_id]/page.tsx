import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { withBasePath, withBasePathForApiUrl } from "@/lib/base-path";
import { getTargetById } from "@/lib/data";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";
import { Spectrum1DViewer } from "@/components/spectrum-1d-viewer";

function isImageAssetPath(pathname: string): boolean {
  return /\.(png|jpg|jpeg)(\?|$)/i.test(pathname);
}

function ancillaryTagLabel(assetType: string, storageKey: string): string {
  const key = storageKey.toLowerCase();
  if (key.includes("jades_photometry/")) {
    return "Photometry";
  }
  if (assetType === "spectrum" && /\.(png|jpg|jpeg)$/i.test(key)) {
    return "spec-plot";
  }
  if (assetType === "other" && /\.fits$/i.test(key)) {
    return "spec-fits";
  }
  return assetType;
}

function isSpecPlotAsset(assetType: string, storageKey: string): boolean {
  return assetType === "spectrum" && /\.(png|jpg|jpeg)$/i.test(storageKey.toLowerCase());
}

export default async function TargetDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ emerald_id: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { emerald_id } = await params;
  const resolvedSearchParams = await searchParams;
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
  const oneDSpectrumAssets = target.ancillary_assets
    .filter(
      (asset) =>
        /_x1d\.fits$/i.test(asset.storage_key) ||
        /_x1d\.json$/i.test(asset.storage_key)
    )
    .map((asset) => ({
      storageKey: asset.storage_key,
      label: asset.label,
      profile: asset.spectrum_profile
    }));
  const requestedNext = typeof resolvedSearchParams.next === "string" ? resolvedSearchParams.next : "";
  const backHref = requestedNext.startsWith("/portal/targets") ? requestedNext : "/portal/targets";

  return (
    <div className="grid">
      <p>
        <Link href={withBasePath(backHref)}>← Back to catalog</Link>
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
              <article
                key={`${asset.asset_type}-${asset.storage_key}-${asset.spectrum_profile ?? ""}`}
                className="card"
                style={{ padding: "0.75rem 0.9rem" }}
              >
                <p>
                  <span className="tag">{ancillaryTagLabel(asset.asset_type, asset.storage_key)}</span> {asset.label}
                </p>
                <p className="muted">Storage key: {asset.storage_key}</p>
                {asset.preview_url ? (
                  <div className="grid">
                    <p style={{ margin: "0.15rem 0" }}>
                      <a href={withBasePathForApiUrl(asset.preview_url)} target="_blank" rel="noreferrer">
                        {/\.fits$/i.test(asset.storage_key) ? "Download FITS" : "Preview"}
                      </a>
                    </p>
                    {(asset.asset_type === "image" ||
                      (asset.asset_type === "spectrum" &&
                        asset.preview_url &&
                        isImageAssetPath(asset.preview_url))) ? (
                      (() => {
                        const isSpecPlot = isSpecPlotAsset(asset.asset_type, asset.storage_key);
                        return (
                          <Image
                            src={withBasePathForApiUrl(asset.preview_url)}
                            alt={`${target.emerald_id} ${asset.label}`}
                            width={isSpecPlot ? 1100 : 320}
                            height={isSpecPlot ? 700 : 320}
                            unoptimized
                            style={{
                              width: isSpecPlot ? "100%" : "min(320px, 100%)",
                              maxWidth: isSpecPlot ? "100%" : "320px",
                              height: "auto",
                              borderRadius: "8px",
                              border: "1px solid #d8e0e3"
                            }}
                          />
                        );
                      })()
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {oneDSpectrumAssets.length > 0 ? (
        <Spectrum1DViewer
          assets={oneDSpectrumAssets}
          zSpec={target.z_spec}
          sourceName={target.name}
          emeraldId={target.emerald_id}
        />
      ) : null}

      <form method="post" action={withBasePath("/api/portal/logout")}>
        <button type="submit" className="secondary">
          Sign out portal session
        </button>
      </form>
    </div>
  );
}
