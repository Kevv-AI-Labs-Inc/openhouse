import { describe, expect, it } from "vitest";
import {
  isPro,
  isProLikeFeatureAccess,
  hasUsageCap,
  hasUnlimitedAiQueries,
  hasPdlCredits,
  PLAN_LIMITS,
  PRO_TRIAL_LIMITS,
} from "@/lib/plans";

describe("isPro", () => {
  it("returns true only for 'pro'", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("free")).toBe(false);
    expect(isPro("trial_pro")).toBe(false);
    expect(isPro("")).toBe(false);
  });
});

describe("isProLikeFeatureAccess", () => {
  it("returns true for pro and trial_pro", () => {
    expect(isProLikeFeatureAccess("pro")).toBe(true);
    expect(isProLikeFeatureAccess("trial_pro")).toBe(true);
  });

  it("returns false for free", () => {
    expect(isProLikeFeatureAccess("free")).toBe(false);
  });
});

describe("hasUsageCap", () => {
  it("returns true for finite numbers", () => {
    expect(hasUsageCap(150)).toBe(true);
    expect(hasUsageCap(0)).toBe(true);
  });

  it("returns false for null (unlimited)", () => {
    expect(hasUsageCap(null)).toBe(false);
  });
});

describe("hasUnlimitedAiQueries", () => {
  it("negative numbers mean unlimited", () => {
    expect(hasUnlimitedAiQueries(-1)).toBe(true);
    expect(hasUnlimitedAiQueries(-100)).toBe(true);
  });

  it("zero or positive numbers are limited", () => {
    expect(hasUnlimitedAiQueries(0)).toBe(false);
    expect(hasUnlimitedAiQueries(10)).toBe(false);
  });
});

describe("hasPdlCredits", () => {
  it("returns true when under the limit", () => {
    expect(hasPdlCredits(0, 10)).toBe(true);
    expect(hasPdlCredits(9, 10)).toBe(true);
  });

  it("returns false when at or over the limit", () => {
    expect(hasPdlCredits(10, 10)).toBe(false);
    expect(hasPdlCredits(15, 10)).toBe(false);
  });
});

describe("PLAN_LIMITS constants", () => {
  it("free plan has finite sign-in cap", () => {
    expect(PLAN_LIMITS.free.maxSignInsPerMonth).toBe(150);
    expect(hasUsageCap(PLAN_LIMITS.free.maxSignInsPerMonth)).toBe(true);
  });

  it("pro plan has no sign-in cap", () => {
    expect(PLAN_LIMITS.pro.maxSignInsPerMonth).toBeNull();
    expect(hasUsageCap(PLAN_LIMITS.pro.maxSignInsPerMonth)).toBe(false);
  });

  it("free plan restricts AI features", () => {
    expect(PLAN_LIMITS.free.aiLeadScoring).toBe(false);
    expect(PLAN_LIMITS.free.aiFollowUp).toBe(false);
    expect(PLAN_LIMITS.free.aiPropertyQa).toBe(false);
    expect(PLAN_LIMITS.free.aiQueries).toBe(0);
  });

  it("pro plan enables all AI features", () => {
    expect(PLAN_LIMITS.pro.aiLeadScoring).toBe(true);
    expect(PLAN_LIMITS.pro.aiFollowUp).toBe(true);
    expect(PLAN_LIMITS.pro.aiPropertyQa).toBe(true);
    expect(hasUnlimitedAiQueries(PLAN_LIMITS.pro.aiQueries)).toBe(true);
  });

  it("free seller report is basic, pro is detailed", () => {
    expect(PLAN_LIMITS.free.sellerReport).toBe("basic");
    expect(PLAN_LIMITS.pro.sellerReport).toBe("detailed");
  });
});

describe("PRO_TRIAL_LIMITS", () => {
  it("limits trial to 3 launches for 30 days", () => {
    expect(PRO_TRIAL_LIMITS.includedLaunches).toBe(3);
    expect(PRO_TRIAL_LIMITS.durationDays).toBe(30);
  });
});
