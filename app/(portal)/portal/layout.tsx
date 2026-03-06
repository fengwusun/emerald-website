"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
      </nav>
      {children}
    </div>
  );
}
