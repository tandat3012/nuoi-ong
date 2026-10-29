export type ScanTarget = {
  kind: "asset" | "item" | "inventory";
  id: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function isAssetCode(code: string) {
  return Boolean(code.trim()) && [...code].length <= 100 && !/\p{Cc}/u.test(code);
}

/**
 * Labels hold `{web}/scan/{assetCode}`, `/scan/item/{itemId}` or
 * `/scan/inventory/{balanceId}`; older asset labels hold the bare code.
 */
export function parseScan(value: string, origin: string): ScanTarget | null {
  const text = value.trim();
  if (!/^https?:\/\//i.test(text) && !text.startsWith("/"))
    return isAssetCode(text) ? { kind: "asset", id: text } : null;
  try {
    const url = new URL(text, origin);
    if (url.origin !== origin || url.search || url.hash) return null;
    const typed = /^\/scan\/(item|inventory)\/([^/]+)$/.exec(url.pathname);
    if (typed)
      return isUuid(typed[2])
        ? { kind: typed[1] as "item" | "inventory", id: typed[2].toLowerCase() }
        : null;
    const asset = /^\/scan\/([^/]+)$/.exec(url.pathname);
    if (!asset) return null;
    const code = decodeURIComponent(asset[1]);
    return isAssetCode(code) ? { kind: "asset", id: code } : null;
  } catch {
    return null;
  }
}

export function scanPath({ kind, id }: ScanTarget) {
  return kind === "asset"
    ? `/scan/${encodeURIComponent(id)}`
    : `/scan/${kind}/${id}`;
}
