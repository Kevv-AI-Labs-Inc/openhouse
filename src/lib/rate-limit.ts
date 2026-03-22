import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __openhouseRateLimitStore: Map<string, Bucket> | undefined;
  var __openhouseUpstashRedis: Redis | undefined;
  var __openhouseUpstashLimiters: Map<string, Ratelimit> | undefined;
}

function getStore() {
  if (!globalThis.__openhouseRateLimitStore) {
    globalThis.__openhouseRateLimitStore = new Map<string, Bucket>();
  }

  return globalThis.__openhouseRateLimitStore;
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!globalThis.__openhouseUpstashRedis) {
    globalThis.__openhouseUpstashRedis = new Redis({
      url,
      token,
    });
  }

  return globalThis.__openhouseUpstashRedis;
}

function getLimiter(limit: number, windowMs: number) {
  const redis = getRedis();

  if (!redis) {
    return null;
  }

  if (!globalThis.__openhouseUpstashLimiters) {
    globalThis.__openhouseUpstashLimiters = new Map<string, Ratelimit>();
  }

  const key = `${limit}:${windowMs}`;
  const existing = globalThis.__openhouseUpstashLimiters.get(key);

  if (existing) {
    return existing;
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.ceil(windowMs / 1000))} s`),
    analytics: false,
    prefix: `openhouse:rate-limit:${key}`,
  });

  globalThis.__openhouseUpstashLimiters.set(key, limiter);

  return limiter;
}

export function getClientIp(headers: Headers) {
  const trustedHeaders = [
    headers.get("x-vercel-forwarded-for"),
    headers.get("cf-connecting-ip"),
    headers.get("fly-client-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
  ];

  for (const value of trustedHeaders) {
    if (value?.trim()) {
      return value.trim();
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() || "unknown";
    }
  }

  return headers.get("x-real-ip") || "unknown";
}

function checkLocalRateLimit({
  key,
  limit,
  windowMs = DEFAULT_WINDOW_MS,
}: {
  key: string;
  limit: number;
  windowMs?: number;
}) {
  const store = getStore();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      resetAt,
    };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;
  store.set(key, bucket);

  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export async function checkRateLimit({
  key,
  limit,
  windowMs = DEFAULT_WINDOW_MS,
}: {
  key: string;
  limit: number;
  windowMs?: number;
}) {
  const limiter = getLimiter(limit, windowMs);

  if (!limiter) {
    return checkLocalRateLimit({ key, limit, windowMs });
  }

  const result = await limiter.limit(key);

  return {
    ok: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}
