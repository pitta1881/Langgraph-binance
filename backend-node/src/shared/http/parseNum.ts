import { UpstreamShapeError } from '../errors/upstream.ts';

/**
 * Coerces `v` to a number and throws UpstreamShapeError if the result is NaN.
 */
export function parseNum(v: unknown, field: string, url = ''): number {
  const n = Number(v);
  if (Number.isNaN(n)) {
    throw new UpstreamShapeError({ url, field });
  }
  return n;
}
