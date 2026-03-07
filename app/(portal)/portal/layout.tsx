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

  if (isLoginPage) {
    return <div className="grid">{children}</div>;
  }

  return (
    <div className="grid">
      <nav className="card nav" aria-label="Portal navigation">
        <Link href={withBasePath("/portal")}>Overview</Link>
        <Link href={withBasePath("/portal/targets")}>Targets</Link>
        <Link href={withBasePath("/portal/redshift-submissions")}>Redshift Reports</Link>
        <a href={withBasePath("/fitsmap/index.html")} target="_blank" rel="noreferrer">
          FitsMap
        </a>
        <Link href={withBasePath("/portal/spectra")}>Quick Interactive</Link>
      </nav>
      {children}
    </div>
  );
}
