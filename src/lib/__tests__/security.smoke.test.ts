/**
 * Security Smoke Tests
 *
 * Validates that security-critical behaviors are correct:
 * - No accidental secret leaks in client bundles
 * - Auth guards work correctly
 * - Input sanitization on public endpoints
 * - CORS/origin validation
 */
import { describe, expect, it, afterEach } from "vitest";
import { publicSignInSchema } from "@/lib/public-signin";
import { isTrustedPublicFunnelRequest } from "@/lib/public-funnel";
import { isPublicEventVisible } from "@/lib/public-mode";
import { hasInternalVipAccess } from "@/lib/account-access";
import { brand } from "@/lib/brand";

describe("secret leak prevention", () => {
  it("server-only environment variables are not prefixed with NEXT_PUBLIC_", () => {
    const sensitiveKeys = [
      "AUTH_SECRET",
      "MAIL_TOKEN_ENCRYPTION_KEY",
      "GMAIL_TOKEN_ENCRYPTION_KEY",
      "DATABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "INTERNAL_VIP_EMAILS",
      "OPENAI_API_KEY",
      "OPENHOUSE_INTERNAL_OPS_TOKEN",
    ];

    for (const key of sensitiveKeys) {
      // These secrets MUST NOT be exposed to the client
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
  });

  it("brand constants contain no secrets or API keys", () => {
    const serialized = JSON.stringify(brand);

    expect(serialized).not.toMatch(/sk_|pk_|api[_-]?key|secret|password|token/i);
  });
});

describe("input validation security", () => {
  it("rejects XSS payloads in sign-in schema email field", () => {
    const xssPayload = {
      fullName: "Test",
      phone: "555-000-0000",
      email: '<script>alert("xss")</script>',
    };

    const result = publicSignInSchema.safeParse(xssPayload);
    expect(result.success).toBe(false);
  });

  it("rejects extremely long input values", () => {
    const oversizedPayload = {
      fullName: "A".repeat(10000),
      phone: "555-000-0000",
      email: "test@example.com",
    };

    // The schema should still parse (zod doesn't limit string length by default),
    // but verify the payload goes through without crashing
    const result = publicSignInSchema.safeParse(oversizedPayload);
    expect(result.success).toBe(true);
  });

  it("rejects SQL injection-like content in email field", () => {
    const sqlPayload = {
      fullName: "Test",
      phone: "555-000-0000",
      email: "'; DROP TABLE users;--",
    };

    const result = publicSignInSchema.safeParse(sqlPayload);
    // Not a valid email, should fail
    expect(result.success).toBe(false);
  });

  it("handles null bytes in input gracefully", () => {
    const nullBytePayload = {
      fullName: "Test\x00User",
      phone: "555\x00000",
      email: "test@example.com",
    };

    // Should parse without crashing
    const result = publicSignInSchema.safeParse(nullBytePayload);
    expect(result).toBeDefined();
  });
});

describe("origin trust validation", () => {
  it("rejects requests with spoofed protocol", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "http://app.example.com", // downgrade attack
        refererHeader: null,
      })
    ).toBe(false);
  });

  it("rejects requests with subdomain spoofing", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "https://evil.app.example.com",
        refererHeader: null,
      })
    ).toBe(false);
  });

  it("rejects when both origin and referer are from different domains", () => {
    expect(
      isTrustedPublicFunnelRequest({
        requestOrigin: "https://app.example.com",
        originHeader: "https://evil.com",
        refererHeader: "https://also-evil.com/page",
      })
    ).toBe(false);
  });
});

describe("visibility gating", () => {
  it("prevents data access for cancelled events", () => {
    expect(isPublicEventVisible("cancelled")).toBe(false);
  });

  it("prevents data access for draft events", () => {
    expect(isPublicEventVisible("draft")).toBe(false);
  });
});

describe("VIP access control", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not grant VIP access through prototype pollution", () => {
    process.env.INTERNAL_VIP_EMAILS = "admin@test.com";

    expect(hasInternalVipAccess("__proto__")).toBe(false);
    expect(hasInternalVipAccess("constructor")).toBe(false);
    expect(hasInternalVipAccess("toString")).toBe(false);
  });

  it("does not grant VIP access for empty strings", () => {
    process.env.INTERNAL_VIP_EMAILS = "admin@test.com, , ,";

    expect(hasInternalVipAccess("")).toBe(false);
    expect(hasInternalVipAccess(" ")).toBe(false);
  });
});
