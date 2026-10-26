/** Lowercases and strips Vietnamese diacritics so "mat ong" matches "Mật ong". */
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/** True when every word of the query appears somewhere in the text. */
export function matchesSearch(text: string, query: string) {
  const haystack = normalizeSearch(text);
  return normalizeSearch(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
