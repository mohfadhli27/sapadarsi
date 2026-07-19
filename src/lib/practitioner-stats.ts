/** Statistik tampilan kartu (simulasi) — konsisten per kode praktisi. */
export function practitionerDisplayStats(code: string) {
  let hash = 0;
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const years = 3 + (hash % 18);
  const rating = 88 + (hash % 12);
  return { years, rating };
}
