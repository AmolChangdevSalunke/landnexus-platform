/**
 * Normalises backend master-data names and bundled map boundary names so they
 * can be compared safely. The map dataset names districts like "Pune District"
 * while the backend stores "Pune"; divisions are stripped for the same reason.
 */
export function normalizeMapName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bdistrict\b/g, '')
    .replace(/\bdivision\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}
