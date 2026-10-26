export function parseAssetScan(value: string, origin: string): string | null {
  let code = value.trim();
  if (/^https?:\/\//i.test(code) || code.startsWith("/")) {
    try {
      const url = new URL(code, origin);
      if (
        url.origin !== origin ||
        url.search ||
        url.hash ||
        !/^\/scan\/[^/]+$/.test(url.pathname)
      )
        return null;
      code = decodeURIComponent(url.pathname.slice("/scan/".length));
    } catch {
      return null;
    }
  }
  if (!code.trim() || [...code].length > 100 || /\p{Cc}/u.test(code))
    return null;
  return code;
}
