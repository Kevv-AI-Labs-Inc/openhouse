import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeStoredPlanTier,
  hasInternalVipAccess,
  resolvePlanTier,
} from "@/lib/account-access";

describe("normalizeStoredPlanTier", () => {
  it("returns 'pro' for the string 'pro'", () => {
    expect(normalizeStoredPlanTier("pro")).toBe("pro");
  });

  it("returns 'free' for any other string", () => {
    expect(normalizeStoredPlanTier("free")).toBe("free");
    expect(normalizeStoredPlanTier("trial")).toBe("free");
    expect(normalizeStoredPlanTier("premium")).toBe("free");
    expect(normalizeStoredPlanTier("")).toBe("free");
  });

  it("returns 'free' for null and undefined", () => {
    expect(normalizeStoredPlanTier(null)).toBe("free");
    expect(normalizeStoredPlanTier(undefined)).toBe("free");
  });
});

describe("hasInternalVipAccess", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when no VIP emails are configured", () => {
    delete process.env.INTERNAL_VIP_EMAILS;
    expect(hasInternalVipAccess("user@example.com")).toBe(false);
  });

  it("returns false for null/undefined email", () => {
    process.env.INTERNAL_VIP_EMAILS = "vip@example.com";
    expect(hasInternalVipAccess(null)).toBe(false);
    expect(hasInternalVipAccess(undefined)).toBe(false);
  });

  it("returns true when email is in the VIP list", () => {
    process.env.INTERNAL_VIP_EMAILS = "admin@test.com, vip@example.com";
    expect(hasInternalVipAccess("vip@example.com")).toBe(true);
  });

  it("matches case-insensitively", () => {
    process.env.INTERNAL_VIP_EMAILS = "Admin@Test.com";
    expect(hasInternalVipAccess("admin@test.com")).toBe(true);
    expect(hasInternalVipAccess("ADMIN@TEST.COM")).toBe(true);
  });

  it("trims whitespace in the env list and lookup", () => {
    process.env.INTERNAL_VIP_EMAILS = "  vip@example.com  ,  admin@test.com  ";
    expect(hasInternalVipAccess("  vip@example.com  ")).toBe(true);
  });

  it("returns false when email is not in the VIP list", () => {
    process.env.INTERNAL_VIP_EMAILS = "admin@test.com";
    expect(hasInternalVipAccess("other@test.com")).toBe(false);
  });
});

describe("resolvePlanTier", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the stored tier when no VIP access", () => {
    delete process.env.INTERNAL_VIP_EMAILS;
    expect(resolvePlanTier({ subscriptionTier: "pro" })).toBe("pro");
    expect(resolvePlanTier({ subscriptionTier: "free" })).toBe("free");
    expect(resolvePlanTier({ subscriptionTier: null })).toBe("free");
  });

  it("upgrades to pro for VIP emails regardless of stored tier", () => {
    process.env.INTERNAL_VIP_EMAILS = "vip@example.com";

    expect(
      resolvePlanTier({ subscriptionTier: "free", email: "vip@example.com" })
    ).toBe("pro");
    expect(
      resolvePlanTier({ subscriptionTier: null, email: "vip@example.com" })
    ).toBe("pro");
  });

  it("does not upgrade non-VIP emails", () => {
    process.env.INTERNAL_VIP_EMAILS = "vip@example.com";

    expect(
      resolvePlanTier({ subscriptionTier: "free", email: "regular@example.com" })
    ).toBe("free");
  });
});
