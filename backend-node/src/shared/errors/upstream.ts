export interface UpstreamErrorDetails {
  url: string;
  status?: number;
}

/** Thrown when an upstream HTTP response body cannot be parsed as JSON. */
export class UpstreamParseError extends Error {
  readonly name = 'UpstreamParseError' as const;
  constructor(public readonly details: UpstreamErrorDetails) {
    super(`Upstream JSON parse failed at ${details.url} (status ${details.status ?? 'unknown'})`);
  }
}

/** Thrown when an upstream JSON response has an unexpected shape (e.g. NaN numeric field). */
export class UpstreamShapeError extends Error {
  readonly name = 'UpstreamShapeError' as const;
  constructor(public readonly details: UpstreamErrorDetails & { field: string }) {
    super(`Upstream shape error: field '${details.field}' is NaN at ${details.url}`);
  }
}

/** Thrown when Binance returns 400 for an unknown trading pair. */
export class InvalidSymbolError extends Error {
  readonly name = 'InvalidSymbolError' as const;
  constructor(public readonly details: { symbol: string }) {
    super(`Invalid symbol: ${details.symbol}`);
  }
}
