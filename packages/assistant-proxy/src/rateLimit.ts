/**
 * A sliding-window limit per visitor, kept in memory. On a host that runs many copies of the function each
 * copy counts separately, so this is a brake, not a guarantee: set a rate-limiting rule at the host as well
 * (docs/DEPLOY.md), and a spending limit on the API key.
 */
export interface RateLimiter {
  /** Records one request. Returns null if allowed, or how many seconds to wait. */
  hit(visitor: string, now: number): number | null;
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const seen = new Map<string, number[]>();
  return {
    hit(visitor, now) {
      const recent = (seen.get(visitor) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        seen.set(visitor, recent);
        return Math.max(1, Math.ceil((windowMs - (now - recent[0]!)) / 1000));
      }
      recent.push(now);
      seen.set(visitor, recent);
      // Forget visitors that have gone quiet, so the table cannot grow for ever.
      if (seen.size > 5_000) for (const [k, v] of seen) if (v.every((t) => now - t >= windowMs)) seen.delete(k);
      return null;
    },
  };
}
