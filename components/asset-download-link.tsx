"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/base-path";

export function AssetDownloadLink({
  storageKey,
  label
}: {
  storageKey: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${withBasePath("/api/assets/sign")}?key=${encodeURIComponent(storageKey)}`
      );
      const payload = (await response.json()) as { signedUrl?: string; error?: string };

      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || "Unable to generate signed URL");
      }

      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" className="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Generating…" : `Open ${label}`}
      </button>
      {error ? <p className="notice">{error}</p> : null}
    </div>
  );
}
