export const PORTAL_COOKIE_NAME = "emerald_portal_session";
export const SCIENCE_ADMIN_COOKIE_NAME = "emerald_science_admin_session";

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

function getScienceAdminPassword(): string | null {
  const generic = process.env.EMERALD_ADMIN_PASSWORD?.trim();
  if (generic) return generic;
  const configured = process.env.EMERALD_SCIENCE_ADMIN_PASSWORD?.trim();
  if (configured) return configured;
  return getPortalPassword();
}

function getScienceAdminCookieSecret(): string | null {
  const configured = process.env.EMERALD_SCIENCE_ADMIN_COOKIE_SECRET?.trim();
  if (configured) return configured;
  return getPortalCookieSecret();
}

export function isScienceAdminConfigured(): boolean {
  return Boolean(getScienceAdminPassword() && getScienceAdminCookieSecret());
}

export function isScienceAdminPasswordValid(password: string): boolean {
  const expected = getScienceAdminPassword();
  if (!expected) {
    return false;
  }
  return password === expected;
}

export function expectedScienceAdminSessionValue(): string {
  const secret = getScienceAdminCookieSecret();
  if (!secret) {
    throw new Error("EMERALD_SCIENCE_ADMIN_COOKIE_SECRET (or portal cookie secret) is not set");
  }
  return secret;
}

export function hasScienceAdminSession(cookieValue: string | undefined): boolean {
  const expected = getScienceAdminCookieSecret();
  if (!cookieValue) {
    return false;
  }
  if (!expected) {
    return false;
  }
  return cookieValue === expected;
}
