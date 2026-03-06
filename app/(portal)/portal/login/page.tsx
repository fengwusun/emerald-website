import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasPortalSession, PORTAL_COOKIE_NAME } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const existing = cookieStore.get(PORTAL_COOKIE_NAME)?.value;

  const nextPath = params.next && params.next.startsWith("/")
    ? params.next
    : withBasePath("/portal/targets");

  if (hasPortalSession(existing)) {
    redirect(nextPath);
  }

  return (
    <div className="grid" style={{ maxWidth: "420px" }}>
      <h1>Portal Login</h1>
      <form className="card" method="post" action={withBasePath("/api/portal/login")}>
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="password">Shared Password</label>
        <input id="password" name="password" type="password" required />
        {params.error ? <p className="notice">Invalid password.</p> : null}
        <button type="submit" style={{ marginTop: "0.8rem" }}>
          Sign In
        </button>
      </form>
    </div>
  );
}
