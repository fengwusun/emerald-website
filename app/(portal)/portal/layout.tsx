"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { withBasePath } from "@/lib/base-path";

export default function PortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname.endsWith("/portal/login");
  const isOverview = pathname === withBasePath("/portal");
  const isTargets = pathname.startsWith(withBasePath("/portal/targets"));
  const isReports = pathname.startsWith(withBasePath("/portal/redshift-submissions"));
  const isQuickInteractive = pathname.startsWith(withBasePath("/portal/spectra"));

  if (isLoginPage) {
    return <div className="grid">{children}</div>;
  }

  return (
    <div className="grid">
      <nav className="card nav" aria-label="Portal navigation">
        <Link
          href={withBasePath("/portal")}
          aria-current={isOverview ? "page" : undefined}
          style={isOverview ? { fontWeight: 700 } : undefined}
        >
          Overview
        </Link>
        <Link
          href={withBasePath("/portal/targets")}
          aria-current={isTargets ? "page" : undefined}
          style={isTargets ? { fontWeight: 700 } : undefined}
        >
          Targets Catalog
        </Link>
        <Link
          href={withBasePath("/portal/redshift-submissions")}
          aria-current={isReports ? "page" : undefined}
          style={isReports ? { fontWeight: 700 } : undefined}
        >
          Redshift Reports
        </Link>
        <a href={withBasePath("/fitsmap/index.html")} target="_blank" rel="noreferrer">
          FitsMap
        </a>
        <Link
          href={withBasePath("/portal/spectra")}
          aria-current={isQuickInteractive ? "page" : undefined}
          style={isQuickInteractive ? { fontWeight: 700 } : undefined}
        >
          Quick Interactive
        </Link>
      </nav>
      {children}
    </div>
  );
}
