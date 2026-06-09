import { UpstreamShapeError } from '../clients/_errors.ts';

/**
 * Coerces `v` to a number and throws UpstreamShapeError if the result is NaN.
 *
 * @param v     - Raw value from upstream JSON.
 * @param field - Field name used in the error message and details.
 * @param url   - Upstream URL, forwarded to UpstreamShapeError.details.
 */
export function parseNum(v: unknown, field: string, url = ''): number {
  const n = Number(v);
  if (Number.isNaN(n)) {
    throw new UpstreamShapeError({ url, field });
  }
  return n;
}
