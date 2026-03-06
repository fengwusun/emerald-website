export const PORTAL_COOKIE_NAME = "emerald_portal_session";

export function expectedSessionValue(): string {
  const secret = process.env.EMERALD_PORTAL_COOKIE_SECRET;
  if (!secret) {
    throw new Error("EMERALD_PORTAL_COOKIE_SECRET is not set");
  }
  return secret;
}

export function isPortalPasswordValid(password: string): boolean {
  const expected = process.env.EMERALD_PORTAL_PASSWORD;
  if (!expected) {
    throw new Error("EMERALD_PORTAL_PASSWORD is not set");
  }
  return password === expected;
}

export function hasPortalSession(cookieValue: string | undefined): boolean {
  if (!cookieValue) {
    return false;
  }
  return cookieValue === expectedSessionValue();
}
