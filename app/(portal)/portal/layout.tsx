import Link from "next/link";

export default function PortalLayout({
  children
}: {
  children: React.ReactNode;
}) {
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
