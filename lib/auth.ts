export const PORTAL_COOKIE_NAME = "emerald_portal_session";

function getPortalPassword(): string | null {
  const configured = process.env.EMERALD_PORTAL_PASSWORD?.trim();
  return configured || null;
}

function getPortalCookieSecret(): string | null {
  const configured = process.env.EMERALD_PORTAL_COOKIE_SECRET?.trim();
  return configured || null;
}

export function isPortalAuthConfigured(): boolean {
  return Boolean(getPortalPassword() && getPortalCookieSecret());
}

export function expectedSessionValue(): string {
  const secret = getPortalCookieSecret();
  if (!secret) {
    throw new Error("EMERALD_PORTAL_COOKIE_SECRET is not set");
  }
  return secret;
}

export function isPortalPasswordValid(password: string): boolean {
  const expected = getPortalPassword();
  if (!expected) {
    return false;
  }
  return password === expected;
}

export function hasPortalSession(cookieValue: string | undefined): boolean {
  const expected = getPortalCookieSecret();
  if (!cookieValue) {
    return false;
  }
  if (!expected) {
    return false;
  }
  return cookieValue === expected;
}
