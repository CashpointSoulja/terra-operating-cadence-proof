const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01 for a strict YYYY-MM-DD calendar date, or null if invalid. */
export function dayNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = ISO.exec(value);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return Math.round(t / 86400000);
}

export function isoFromDay(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const n = dayNumber(iso);
  if (n === null) throw new Error('invalid date');
  return isoFromDay(n + days);
}
