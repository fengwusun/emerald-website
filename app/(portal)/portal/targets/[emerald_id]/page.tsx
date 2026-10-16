import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { withBasePath, withBasePathForApiUrl } from "@/lib/base-path";
import { getTargetById } from "@/lib/data";
import { groupTargetProducts } from "@/lib/product-groups";
import { getEmissionLineTagsForTarget, getQuickTagsForTarget } from "@/lib/target-tags";
import { Spectrum1DViewer } from "@/components/spectrum-1d-viewer";

function TagList({ tags, empty }: { tags: string[]; empty: string }) {
  if (tags.length === 0) {
    return <span className="muted">{empty}</span>;
  }
  return (
    <span className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          {tag}
        </span>
      ))}
    </span>
  );
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
      (asset) => /_x1d\.json$/i.test(asset.storage_key)
    )
    .map((asset) => ({
      storageKey: asset.storage_key,
      label: asset.label,
      profile: asset.spectrum_profile
    }));
  const productGroups = groupTargetProducts(target.ancillary_assets);
  const bundleNote = productGroups.find((group) => group.note)?.note;
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
        <dl className="meta-grid">
          <dt>Coordinates</dt>
          <dd>
            RA {target.ra} · Dec {target.dec}
          </dd>
          <dt>z_spec</dt>
          <dd>{Math.abs(target.z_spec - 1) < 1e-9 ? -1 : target.z_spec}</dd>
          <dt>Program</dt>
          <dd>
            JWST {target.jwst_program_id} · priority {target.priority}
          </dd>
          <dt>Modes</dt>
          <dd>
            <TagList
              tags={observationModes.map((mode) => `${mode.instrument} · ${mode.status}`)}
              empty="Not labeled"
            />
          </dd>
          <dt>Quick tags</dt>
          <dd>
            <TagList tags={quickTags} empty="None" />
          </dd>
          <dt>Emission lines</dt>
          <dd>
            <TagList tags={emissionLineTags} empty="None in VI table" />
          </dd>
          <dt>Notes</dt>
          <dd>{target.notes || "None"}</dd>
        </dl>
        <div className="product-row" style={{ marginTop: "0.75rem" }}>
          <a
            className="btn-link"
            href={`https://jades.idies.jhu.edu/goods-n/?ra=${target.ra}&dec=${target.dec}&zoom=11`}
            target="_blank"
            rel="noreferrer"
          >
            JADES FitsMap ↗
          </a>
          {jadesNumericId ? (
            <a
              className="btn-link"
              href={`https://jades.idies.jhu.edu/goods-n/goodsn_eazy_seds_v10e1/${jadesNumericId}_EAZY_SED.png`}
              target="_blank"
              rel="noreferrer"
            >
              EAZY SED ↗
            </a>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Data Products</h2>
        {productGroups.length === 0 ? (
          <p className="muted">No data products registered for this target.</p>
        ) : (
          productGroups.map((group) => (
            <div key={group.key} className="product-group">
              <strong>{group.title}</strong>
              {group.rows.map((row) => (
                <div key={row.key} className="product-row">
                  {row.tag ? <span className="tag">{row.tag}</span> : null}
                  {row.buttons.map((button) => (
                    <a
                      key={button.href}
                      className="btn-link"
                      href={withBasePathForApiUrl(button.href)}
                      title={button.storageKey}
                    >
                      {button.label}
                    </a>
                  ))}
                  {row.preview ? (
                    <a
                      className="product-preview"
                      href={withBasePathForApiUrl(row.preview.src)}
                      target="_blank"
                      rel="noreferrer"
                      title={row.preview.storageKey}
                    >
                      <Image
                        src={withBasePathForApiUrl(row.preview.src)}
                        alt={`${target.emerald_id} ${group.title} ${row.tag}`}
                        width={1100}
                        height={700}
                        unoptimized
                        style={{ width: "100%", height: "auto" }}
                      />
                    </a>
                  ) : null}
                </div>
              ))}
              {group.thumbnails.length > 0 ? (
                <div className="product-thumbs">
                  {group.thumbnails.map((thumbnail) => (
                    <a
                      key={thumbnail.storageKey}
                      href={withBasePathForApiUrl(thumbnail.src)}
                      target="_blank"
                      rel="noreferrer"
                      title={thumbnail.storageKey}
                    >
                      <Image
                        src={withBasePathForApiUrl(thumbnail.src)}
                        alt={`${target.emerald_id} finding chart ${thumbnail.label}`}
                        width={140}
                        height={140}
                        unoptimized
                      />
                      <span className="muted">{thumbnail.label}</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
        {bundleNote ? <p className="muted product-note">{bundleNote}</p> : null}
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
