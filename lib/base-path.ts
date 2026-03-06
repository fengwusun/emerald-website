export const BASE_PATH = "/emerald";

export function withBasePath(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return `${BASE_PATH}/${pathname}`;
  }
  if (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname;
  }
  return `${BASE_PATH}${pathname}`;
}

export function withBasePathForApiUrl(url: string): string {
  if (url.startsWith("/api/")) {
    return withBasePath(url);
  }
  return url;
}
