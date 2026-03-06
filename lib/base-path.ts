const rawBasePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (process.env.NODE_ENV === "production" ? "/emerald" : "");

export const BASE_PATH =
  rawBasePath === "/" ? "" : rawBasePath.replace(/\/+$/, "");

export function withBasePath(pathname: string): string {
  if (!BASE_PATH) {
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }
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
