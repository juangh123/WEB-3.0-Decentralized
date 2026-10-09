const DEV_ADMIN_TOKEN = "dev-token";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Math.max(1, Number.parseInt(process.env.ADMIN_RATE_LIMIT ?? "30", 10) || 30);
const MAX_RATE_BUCKETS = 5_000;

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

/**
 * Returns the admin token, or throws when a production deployment has no explicit token.
 *
 * The old behaviour silently fell back to the public `dev-token`, which turns "forgot to set
 * ADMIN_TOKEN" into a public write endpoint for the sanctions list (and therefore into the
 * ability to trigger or suppress on-chain revocations).
 */
export function getAdminToken(): string {
  const configured = process.env.ADMIN_TOKEN?.trim();

  if (configured && configured !== DEV_ADMIN_TOKEN) {
    return configured;
  }

  if (isProductionRuntime()) {
    throw new Error("ADMIN_TOKEN must be set to a non-default value in production");
  }

  return DEV_ADMIN_TOKEN;
}

/** Best-effort constant-time-ish comparison to avoid trivial token-length oracles. */
export function isAdminTokenValid(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string" || expected.length === 0) return false;
  if (provided.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Simple in-memory sliding window limiter. Documented as best-effort: Vercel functions scale
 * across instances, so this only dampens abuse, it does not guarantee a global rate.
 */
export function checkAdminRateLimit(clientKey: string): boolean {
  const now = Date.now();

  if (rateBuckets.size >= MAX_RATE_BUCKETS) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const bucket = rateBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;

  bucket.count += 1;
  return true;
}
