import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { lt } from "drizzle-orm";
import type { RowDataPacket } from "mysql2/promise";
import { getDb, getPool } from "@/lib/db";
import { rateLimitWindows } from "@/lib/db/schema";

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;

type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __openhouseRateLimitStore: Map<string, Bucket> | undefined;
  var __openhouseUpstashRedis: Redis | undefined;
  var __openhouseUpstashLimiters: Map<string, Ratelimit> | undefined;
  var __openhouseRateLimitDbWarnings: Set<string> | undefined;
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

function getDbWarnings() {
  if (!globalThis.__openhouseRateLimitDbWarnings) {
    globalThis.__openhouseRateLimitDbWarnings = new Set<string>();
  }

  return globalThis.__openhouseRateLimitDbWarnings;
}

function warnRateLimitDbFallback(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown database rate limit error";

  const warnings = getDbWarnings();

  if (warnings.has(message)) {
    return;
  }

  warnings.add(message);
  console.warn(`[RateLimit] Falling back to local limiter: ${message}`);
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

function hashRateLimitKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

async function cleanupExpiredRateLimitWindows() {
  try {
    const db = getDb();
    await db
      .delete(rateLimitWindows)
      .where(lt(rateLimitWindows.resetAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  } catch {
    // Best-effort cleanup only.
  }
}

async function checkDatabaseRateLimit({
  key,
  limit,
  windowMs = DEFAULT_WINDOW_MS,
}: {
  key: string;
  limit: number;
  windowMs?: number;
}) {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const pool = getPool();
    const hashedKey = hashRateLimitKey(key);
    const scope = `${limit}:${windowMs}`;
    const resetAt = new Date(Date.now() + windowMs);

    await pool.query(
      `
        INSERT INTO oh_rate_limit_windows (keyHash, scope, hitCount, resetAt, createdAt, updatedAt)
        VALUES (?, ?, 1, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          hitCount = IF(resetAt <= NOW(), 1, hitCount + 1),
          resetAt = IF(resetAt <= NOW(), VALUES(resetAt), resetAt),
          scope = VALUES(scope),
          updatedAt = NOW()
      `,
      [hashedKey, scope, resetAt]
    );

    type RateLimitRow = RowDataPacket & {
      hitCount: number;
      resetAtMs: number | string;
    };

    const [rows] = await pool.query<RateLimitRow[]>(
      `
        SELECT hitCount, UNIX_TIMESTAMP(resetAt) * 1000 AS resetAtMs
        FROM oh_rate_limit_windows
        WHERE keyHash = ?
        LIMIT 1
      `,
      [hashedKey]
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    if (Math.random() < 0.01) {
      void cleanupExpiredRateLimitWindows();
    }

    return {
      ok: row.hitCount <= limit,
      remaining: Math.max(0, limit - row.hitCount),
      resetAt: Number(row.resetAtMs),
    };
  } catch (error) {
    warnRateLimitDbFallback(error);
    return null;
  }
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
    const dbResult = await checkDatabaseRateLimit({ key, limit, windowMs });

    if (dbResult) {
      return dbResult;
    }

    return checkLocalRateLimit({ key, limit, windowMs });
  }

  const result = await limiter.limit(key);

  return {
    ok: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
  };
}
