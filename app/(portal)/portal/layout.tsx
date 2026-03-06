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
        <Link href="/portal">Overview</Link>
        <Link href="/portal/targets">Targets</Link>
        <a href={withBasePath("/fitsmap/index.html")} target="_blank" rel="noreferrer">
          FitsMap
        </a>
      </nav>
      {children}
    </div>
  );
}
