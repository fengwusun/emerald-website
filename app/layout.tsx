import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMERALD | JWST GO-7935",
  description:
    "EMERALD (efficient measurement of emergence rate of AGN in legacy deep field) team website and data portal."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              EMERALD | JWST GO-7935
            </Link>
            <nav className="nav">
              <Link href="/">Program</Link>
              <Link href="/science-goals">Science Goals</Link>
              <Link href="/observing-plan">Observing Plan</Link>
              <Link href="/team">Team</Link>
              <Link href="/contact-data-policy">Data Policy</Link>
              <Link href="/portal/targets">Portal</Link>
            </nav>
          </div>
        </header>
        <main className="container">
          {children}
          <footer className="footer">
            EMERALD collaboration website for JWST GO-7935. Built with Next.js,
            React, Apache reverse proxy infrastructure, and OpenAI Codex-assisted
            development workflows.
          </footer>
        </main>
      </body>
    </html>
  );
}
