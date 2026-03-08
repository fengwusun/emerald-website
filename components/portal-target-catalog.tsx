"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import { PortalTargetTable } from "@/components/portal-target-table";
import type { TargetRecord } from "@/lib/schemas";

type CatalogResponse = {
  targets?: TargetRecord[];
  error?: string;
};

export function PortalTargetCatalog() {
  const [targets, setTargets] = useState<TargetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const response = await fetch(withBasePath("/api/targets/catalog"), { cache: "no-store" });
        const payload = (await response.json()) as CatalogResponse;
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load targets catalog");
        }
        if (!cancelled) {
          setTargets(payload.targets ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load targets catalog");
          setTargets([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="notice">{error}</p>;
  }

  if (!targets) {
    return (
      <div className="loading-inline">
        <span className="spinner" aria-hidden="true" />
        <p className="muted" style={{ margin: 0 }}>
          Loading target catalog...
        </p>
      </div>
    );
  }

  return <PortalTargetTable targets={targets} />;
}
