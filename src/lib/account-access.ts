import type { PlanTier } from "@/lib/plans";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeStoredPlanTier(tier: string | null | undefined): PlanTier {
  return tier === "pro" ? "pro" : "free";
}

function getConfiguredInternalVipEmails() {
  return new Set(
    (process.env.INTERNAL_VIP_EMAILS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeEmail)
  );
}

export function hasInternalVipAccess(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getConfiguredInternalVipEmails().has(normalizeEmail(email));
}

export function resolvePlanTier(params: {
  subscriptionTier: string | null | undefined;
  email?: string | null;
}): PlanTier {
  if (hasInternalVipAccess(params.email)) {
    return "pro";
  }

  return normalizeStoredPlanTier(params.subscriptionTier);
}
