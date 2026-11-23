/**
 * Catalog titles carry edition tags ("[litres+]", "[худ. А. Карапетян]"). They help in a details view,
 * not on a cover or in a list: strip bracketed segments for display, keep the original if nothing is left.
 */
export function displayTitle(title: string): string {
  const cleaned = title.replace(/\s*\[[^\]]*\]/g, '').replace(/\s{2,}/g, ' ').trim();
  return cleaned || title.trim();
}
