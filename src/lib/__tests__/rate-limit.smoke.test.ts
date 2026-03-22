import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("rate limit smoke", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers trusted platform headers in production", () => {
    process.env.NODE_ENV = "production";

    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1",
      "cf-connecting-ip": "203.0.113.8",
    });

    expect(getClientIp(headers)).toBe("203.0.113.8");
  });

  it("falls back to x-forwarded-for during local development", () => {
    process.env.NODE_ENV = "development";

    const headers = new Headers({
      "x-forwarded-for": "198.51.100.1, 198.51.100.2",
    });

    expect(getClientIp(headers)).toBe("198.51.100.1");
  });

  it("uses the local limiter when no shared backend is configured", async () => {
    const first = await checkRateLimit({
      key: "rate-limit-smoke",
      limit: 1,
      windowMs: 10_000,
    });
    const second = await checkRateLimit({
      key: "rate-limit-smoke",
      limit: 1,
      windowMs: 10_000,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
  });
});
