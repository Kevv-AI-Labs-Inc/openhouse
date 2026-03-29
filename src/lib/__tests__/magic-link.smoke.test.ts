import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_TTL_MINUTES,
  MAGIC_LINK_TTL_MS,
  normalizeMagicLinkEmail,
  createMagicLinkToken,
  hashMagicLinkToken,
  getMagicLinkExpiry,
  buildMagicLinkUrl,
  buildMagicLinkEmailText,
} from "@/lib/magic-link";

describe("MAGIC_LINK_TTL", () => {
  it("has a 15-minute TTL", () => {
    expect(MAGIC_LINK_TTL_MINUTES).toBe(15);
    expect(MAGIC_LINK_TTL_MS).toBe(15 * 60 * 1000);
  });
});

describe("normalizeMagicLinkEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeMagicLinkEmail("  Test@Example.COM  ")).toBe("test@example.com");
  });
});

describe("createMagicLinkToken", () => {
  it("returns a token and its hash", () => {
    const { token, tokenHash } = createMagicLinkToken();

    expect(token).toBeTruthy();
    expect(tokenHash).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(typeof tokenHash).toBe("string");
    expect(token).not.toBe(tokenHash);
  });

  it("generates unique tokens on each call", () => {
    const a = createMagicLinkToken();
    const b = createMagicLinkToken();

    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashMagicLinkToken", () => {
  it("produces a hex string", () => {
    const hash = hashMagicLinkToken("test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const a = hashMagicLinkToken("same-input");
    const b = hashMagicLinkToken("same-input");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = hashMagicLinkToken("input-a");
    const b = hashMagicLinkToken("input-b");
    expect(a).not.toBe(b);
  });
});

describe("getMagicLinkExpiry", () => {
  it("returns a date in the future", () => {
    const expiry = getMagicLinkExpiry();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("expiry is approximately 15 minutes from now", () => {
    const before = Date.now();
    const expiry = getMagicLinkExpiry();
    const after = Date.now();

    const expectedMin = before + MAGIC_LINK_TTL_MS;
    const expectedMax = after + MAGIC_LINK_TTL_MS;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});

describe("buildMagicLinkUrl", () => {
  it("includes the token as a query parameter", () => {
    const url = buildMagicLinkUrl("my-token-123", "/dashboard");

    expect(url).toContain("token=my-token-123");
    expect(url).toContain("/login/magic");
  });

  it("includes callbackUrl for non-default redirects", () => {
    const url = buildMagicLinkUrl("token", "/dashboard/events");

    expect(url).toContain("callbackUrl=%2Fdashboard%2Fevents");
  });

  it("omits callbackUrl for the default /dashboard path", () => {
    const url = buildMagicLinkUrl("token", "/dashboard");

    expect(url).not.toContain("callbackUrl");
  });
});

describe("buildMagicLinkEmailText", () => {
  it("includes the sign-in URL in the body", () => {
    const text = buildMagicLinkEmailText("https://app.test.com/login/magic?token=abc");

    expect(text).toContain("https://app.test.com/login/magic?token=abc");
  });

  it("mentions the TTL in minutes", () => {
    const text = buildMagicLinkEmailText("https://example.com");

    expect(text).toContain("15 minutes");
  });

  it("includes support contact info", () => {
    const text = buildMagicLinkEmailText("https://example.com");

    expect(text).toContain("Need help?");
  });

  it("warns about ignoring unrequested emails", () => {
    const text = buildMagicLinkEmailText("https://example.com");

    expect(text).toContain("did not request");
  });
});
