import Link from "next/link";
import { withBasePath } from "@/lib/base-path";

export default function NotFoundPage() {
  return (
    <div className="grid">
      <h1>Not Found</h1>
      <p className="muted">The requested page or target does not exist.</p>
      <p>
        <Link href={withBasePath("/")}>Return to home</Link>
      </p>
    </div>
  );
}
