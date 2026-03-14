/**
 * Safely coerce any value to an array.
 * Use this when consuming API responses that may return null, undefined,
 * an object, or other non-array types instead of the expected array.
 *
 * Overloaded: when passed a typed array, the element type is preserved.
 * When passed an unknown/any value, returns the inferred type or unknown[].
 *
 * @example
 *   safeArray(data.blocks).map(b => ...)
 *   safeArray(response.programs).filter(p => p.is_active)
 */
export function safeArray<T>(value: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeArray(value: any): any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  return [];
}
