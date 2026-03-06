import { createSign } from "node:crypto";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  projectsRange: string;
  contentRange: string;
  serviceAccountEmail: string;
  privateKey: string;
};

type TokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_SHEETS_API_ROOT = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_PROJECTS_RANGE = "Projects!A:I";
const DEFAULT_CONTENT_RANGE = "Content!A:B";

let tokenCache: TokenCacheEntry | null = null;

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function getGoogleSheetsConfig(): GoogleSheetsConfig | null {
  const spreadsheetId = process.env.SCIENCE_PROJECTS_GOOGLE_SHEETS_ID?.trim();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!spreadsheetId || !serviceAccountEmail || !rawPrivateKey) {
    return null;
  }

  return {
    spreadsheetId,
    projectsRange:
      process.env.SCIENCE_PROJECTS_GOOGLE_PROJECTS_RANGE?.trim() || DEFAULT_PROJECTS_RANGE,
    contentRange:
      process.env.SCIENCE_PROJECTS_GOOGLE_CONTENT_RANGE?.trim() || DEFAULT_CONTENT_RANGE,
    serviceAccountEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n")
  };
}

function createSignedJwt(config: GoogleSheetsConfig): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claimSet = {
    iss: config.serviceAccountEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: nowSeconds + 3600,
    iat: nowSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claimSet));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(config.privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(config: GoogleSheetsConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const assertion = createSignedJwt(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token request failed: ${response.status} ${errorText}`);
  }

  const parsed = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!parsed.access_token) {
    throw new Error("Google OAuth token response did not include an access token.");
  }

  tokenCache = {
    accessToken: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000
  };

  return parsed.access_token;
}

async function sheetsRequest(
  config: GoogleSheetsConfig,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const accessToken = await getAccessToken(config);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${GOOGLE_SHEETS_API_ROOT}/${config.spreadsheetId}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets request failed: ${response.status} ${errorText}`);
  }

  return response;
}

export function isScienceProjectsGoogleSheetsConfigured(): boolean {
  return getGoogleSheetsConfig() !== null;
}

export function getScienceProjectsGoogleSheetsRanges(): {
  projectsRange: string;
  contentRange: string;
} | null {
  const config = getGoogleSheetsConfig();
  if (!config) {
    return null;
  }

  return {
    projectsRange: config.projectsRange,
    contentRange: config.contentRange
  };
}

export async function readGoogleSheetValues(range: string): Promise<string[][]> {
  const config = getGoogleSheetsConfig();
  if (!config) {
    throw new Error("Google Sheets storage is not configured.");
  }

  const response = await sheetsRequest(config, `/values/${encodeURIComponent(range)}`);
  const parsed = (await response.json()) as { values?: unknown };

  if (!Array.isArray(parsed.values)) {
    return [];
  }

  return parsed.values.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []
  );
}

export async function clearGoogleSheetRanges(ranges: string[]): Promise<void> {
  const config = getGoogleSheetsConfig();
  if (!config) {
    throw new Error("Google Sheets storage is not configured.");
  }

  await sheetsRequest(config, "/values:batchClear", {
    method: "POST",
    body: JSON.stringify({ ranges })
  });
}

export async function updateGoogleSheetValues(range: string, values: string[][]): Promise<void> {
  const config = getGoogleSheetsConfig();
  if (!config) {
    throw new Error("Google Sheets storage is not configured.");
  }

  await sheetsRequest(
    config,
    `/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values
      })
    }
  );
}
