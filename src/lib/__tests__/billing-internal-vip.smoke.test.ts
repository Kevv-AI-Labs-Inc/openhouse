import {
  hasInternalVipAccess,
  hasProFeatureAccess,
  resolveFeatureAccessTier,
  resolvePlanTier,
} from "@/lib/billing";

describe("internal vip billing smoke", () => {
  const originalVipEmails = process.env.INTERNAL_VIP_EMAILS;

  afterEach(() => {
    if (originalVipEmails === undefined) {
      delete process.env.INTERNAL_VIP_EMAILS;
      return;
    }

    process.env.INTERNAL_VIP_EMAILS = originalVipEmails;
  });

  it("treats allowlisted emails as pro without changing stored tier", () => {
    process.env.INTERNAL_VIP_EMAILS = "founder@example.com, teammate@example.com";

    expect(hasInternalVipAccess("Founder@example.com")).toBe(true);
    expect(
      resolvePlanTier({
        subscriptionTier: "free",
        email: "founder@example.com",
      })
    ).toBe("pro");
    expect(
      resolveFeatureAccessTier({
        subscriptionTier: "free",
        accountEmail: "founder@example.com",
        eventFeatureAccessTier: "free",
      })
    ).toBe("pro");
    expect(
      hasProFeatureAccess({
        subscriptionTier: "free",
        accountEmail: "founder@example.com",
        eventFeatureAccessTier: "free",
      })
    ).toBe(true);
  });

  it("keeps non-allowlisted users on their stored plan behavior", () => {
    process.env.INTERNAL_VIP_EMAILS = "founder@example.com";

    expect(hasInternalVipAccess("agent@example.com")).toBe(false);
    expect(
      resolvePlanTier({
        subscriptionTier: "free",
        email: "agent@example.com",
      })
    ).toBe("free");
    expect(
      resolveFeatureAccessTier({
        subscriptionTier: "free",
        accountEmail: "agent@example.com",
        eventFeatureAccessTier: "trial_pro",
        proTrialExpiresAt: new Date(Date.now() + 60_000),
      })
    ).toBe("trial_pro");
  });
});
