/**
 * Normalize an API value into a `yyyy-MM-dd` string suitable for
 * `<input type="date">`. The browser refuses ISO timestamp strings
 * like `2026-04-27T00:00:00+00:00` and logs:
 *
 *   The specified value '...' does not conform to the required
 *   format 'yyyy-MM-dd'.
 *
 * When that warning fires the input renders empty AND any save that
 * pulls from formData ships a malformed value back, so the bug is
 * doubly nasty — both display and persistence break.
 *
 * Postgres `date`, `timestamp`, and `timestamptz` columns all share
 * the `T` separator in their JSON encoding, so splitting on `T` is
 * a safe single-pass normalization for every shape the API returns.
 *
 * Accepts:
 *   "2026-04-27"                   → "2026-04-27"
 *   "2026-04-27T00:00:00+00:00"    → "2026-04-27"
 *   "2026-04-27T07:00:00.000Z"     → "2026-04-27"
 *   null / undefined / empty       → ""
 */
export function toDateInput(v: unknown): string {
  if (typeof v !== 'string' || !v) return '';
  return v.split('T')[0];
}

/**
 * Apply `toDateInput` to every key in `record` whose name is listed
 * in `dateFields`. Returns a new object — the input is not mutated.
 * Useful right after loading from the API to seed a form state:
 *
 *   const form = normalizeDates(api.internship, DATE_FIELDS);
 *
 * Keys not present in `record` are ignored.
 */
export function normalizeDates<T extends Record<string, unknown>>(
  record: T,
  dateFields: readonly string[],
): T {
  const out: Record<string, unknown> = { ...record };
  for (const key of dateFields) {
    if (key in out) out[key] = toDateInput(out[key]);
  }
  return out as T;
}
