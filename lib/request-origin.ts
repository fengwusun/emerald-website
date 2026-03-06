export function getPublicOrigin(headers: Headers, fallbackUrl: string): string {
  const forwardedProto = headers.get("x-forwarded-proto");
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = headers.get("host");
  if (host) {
    const proto = forwardedProto || "https";
    return `${proto}://${host}`;
  }

  return new URL(fallbackUrl).origin;
}
