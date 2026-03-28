import { and, eq, gte, lt, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  PLAN_LIMITS,
  PRO_TRIAL_LIMITS,
  isProLikeFeatureAccess,
  type FeatureAccessTier,
  type PlanTier,
} from "@/lib/plans";
import { getDb } from "@/lib/db";
import { events, signIns, users, type User } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/site";
import { isStripeConfigured } from "@/lib/stripe";
import {
  hasInternalVipAccess,
  normalizeStoredPlanTier,
  resolvePlanTier,
} from "@/lib/account-access";

export { hasInternalVipAccess, resolvePlanTier };
export const normalizePlanTier = normalizeStoredPlanTier;

function getPlanUsageEntitlements(tier: PlanTier) {
  const limits = PLAN_LIMITS[tier];

  return {
    pdlCreditsLimit: limits.pdlCredits,
    aiQueriesLimit: limits.aiQueries,
  };
}

function applyEffectivePlanView<T extends Pick<User, "subscriptionTier" | "email"> & {
  pdlCreditsLimit: number;
  aiQueriesLimit: number;
}>(user: T): T {
  const effectiveTier = resolvePlanTier({
    subscriptionTier: user.subscriptionTier,
    email: user.email,
  });

  if (
    effectiveTier === normalizePlanTier(user.subscriptionTier) &&
    user.pdlCreditsLimit === getPlanUsageEntitlements(effectiveTier).pdlCreditsLimit &&
    user.aiQueriesLimit === getPlanUsageEntitlements(effectiveTier).aiQueriesLimit
  ) {
    return user;
  }

  return {
    ...user,
    subscriptionTier: effectiveTier,
    ...getPlanUsageEntitlements(effectiveTier),
  };
}

export function getPlanEntitlements(tier: PlanTier) {
  return {
    subscriptionTier: tier,
    ...getPlanUsageEntitlements(tier),
  };
}

export function getTrialProExpiry(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + PRO_TRIAL_LIMITS.durationDays);
  return expiresAt;
}

export function resolveFeatureAccessTier(params: {
  subscriptionTier: string | null | undefined;
  accountEmail?: string | null;
  eventFeatureAccessTier: string | null | undefined;
  proTrialExpiresAt?: Date | null;
  now?: Date;
}): FeatureAccessTier {
  const {
    subscriptionTier,
    accountEmail,
    eventFeatureAccessTier,
    proTrialExpiresAt,
    now = new Date(),
  } = params;

  if (resolvePlanTier({ subscriptionTier, email: accountEmail }) === "pro") {
    return "pro";
  }

  if (
    eventFeatureAccessTier === "trial_pro" &&
    proTrialExpiresAt instanceof Date &&
    proTrialExpiresAt > now
  ) {
    return "trial_pro";
  }

  return "free";
}

export function hasProFeatureAccess(params: {
  subscriptionTier: string | null | undefined;
  accountEmail?: string | null;
  eventFeatureAccessTier: string | null | undefined;
  proTrialExpiresAt?: Date | null;
  now?: Date;
}) {
  return isProLikeFeatureAccess(resolveFeatureAccessTier(params));
}

export function getNextMonthBoundary(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function getCurrentMonthWindow(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: getNextMonthBoundary(now),
  };
}

function getDefaultUsageResetAt(tier: PlanTier, now = new Date()) {
  if (tier === "free") {
    return getNextMonthBoundary(now);
  }

  const nextReset = new Date(now);
  nextReset.setMonth(nextReset.getMonth() + 1);
  return nextReset;
}

export async function ensureUsageWindow(userId: number) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return null;
  }

  const tier = resolvePlanTier({
    subscriptionTier: user.subscriptionTier,
    email: user.email,
  });
  const now = new Date();
  const resetNeeded = !user.usageResetAt || user.usageResetAt <= now;
  const entitlements = getPlanUsageEntitlements(tier);
  const limitsNeedRepair =
    user.pdlCreditsLimit !== entitlements.pdlCreditsLimit ||
    user.aiQueriesLimit !== entitlements.aiQueriesLimit;

  if (!resetNeeded && !limitsNeedRepair) {
    return applyEffectivePlanView(user);
  }

  const nextResetAt = resetNeeded
    ? getDefaultUsageResetAt(tier, now)
    : user.usageResetAt ?? getDefaultUsageResetAt(tier, now);

  await db
    .update(users)
    .set({
      ...entitlements,
      pdlCreditsUsed: resetNeeded ? 0 : user.pdlCreditsUsed,
      aiQueriesUsed: resetNeeded ? 0 : user.aiQueriesUsed,
      usageResetAt: nextResetAt,
    })
    .where(eq(users.id, userId));

  const [updatedUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return applyEffectivePlanView(updatedUser ?? user);
}

export async function countEventsThisMonth(userId: number) {
  const db = getDb();
  const window = getCurrentMonthWindow();

  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as signed)` })
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.createdAt, window.start), lt(events.createdAt, window.end)));

  return Number(row?.count ?? 0);
}

export async function countSignInsThisMonth(userId: number) {
  const db = getDb();
  const window = getCurrentMonthWindow();

  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as signed)` })
    .from(signIns)
    .innerJoin(events, eq(signIns.eventId, events.id))
    .where(and(eq(events.userId, userId), gte(signIns.signedInAt, window.start), lt(signIns.signedInAt, window.end)));

  return Number(row?.count ?? 0);
}

export async function getBillingSnapshot(userId: number) {
  const user = await ensureUsageWindow(userId);

  if (!user) {
    return null;
  }

  const tier = resolvePlanTier({
    subscriptionTier: user.subscriptionTier,
    email: user.email,
  });
  const limits = PLAN_LIMITS[tier];
  const [eventsUsed, signInsUsed] = await Promise.all([
    countEventsThisMonth(userId),
    countSignInsThisMonth(userId),
  ]);

  return {
    user: applyEffectivePlanView(user),
    tier,
    internalVipAccess: hasInternalVipAccess(user.email),
    limits,
    eventsUsed,
    signInsUsed,
    proTrialLaunchesUsed: user.proTrialLaunchesUsed,
    proTrialLaunchesRemaining: Math.max(
      0,
      PRO_TRIAL_LIMITS.includedLaunches - user.proTrialLaunchesUsed
    ),
    stripeConfigured: isStripeConfigured(),
  };
}

export async function allocateTrialProLaunch(params: {
  userId: number;
  eventId: number;
  now?: Date;
  enableAiQa?: boolean;
}) {
  const { userId, eventId, now = new Date(), enableAiQa = false } = params;
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return null;
  }

  if (
    resolvePlanTier({
      subscriptionTier: user.subscriptionTier,
      email: user.email,
    }) === "pro"
  ) {
    await db
      .update(events)
      .set({
        featureAccessTier: "pro",
        proTrialActivatedAt: null,
        proTrialExpiresAt: null,
      })
      .where(eq(events.id, eventId));

    return {
      featureAccessTier: "pro" as const,
      launchesUsed: user.proTrialLaunchesUsed,
      launchesRemaining: Math.max(
        0,
        PRO_TRIAL_LIMITS.includedLaunches - user.proTrialLaunchesUsed
      ),
    };
  }

  if (user.proTrialLaunchesUsed >= PRO_TRIAL_LIMITS.includedLaunches) {
    return {
      featureAccessTier: "free" as const,
      launchesUsed: user.proTrialLaunchesUsed,
      launchesRemaining: 0,
    };
  }

  const expiresAt = getTrialProExpiry(now);

  await db
    .update(users)
    .set({ proTrialLaunchesUsed: user.proTrialLaunchesUsed + 1 })
    .where(eq(users.id, userId));

  await db
    .update(events)
    .set({
      featureAccessTier: "trial_pro",
      proTrialActivatedAt: now,
      proTrialExpiresAt: expiresAt,
      aiQaEnabled: enableAiQa,
    })
    .where(eq(events.id, eventId));

  return {
    featureAccessTier: "trial_pro" as const,
    launchesUsed: user.proTrialLaunchesUsed + 1,
    launchesRemaining: Math.max(
      0,
      PRO_TRIAL_LIMITS.includedLaunches - (user.proTrialLaunchesUsed + 1)
    ),
    expiresAt,
  };
}

export function getCheckoutSuccessUrl() {
  return absoluteUrl("/dashboard/settings?billing=success");
}

export function getCheckoutCancelUrl() {
  return absoluteUrl("/dashboard/settings?billing=cancelled");
}

export function getBillingPortalReturnUrl() {
  return absoluteUrl("/dashboard/settings");
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const itemPeriodEnd = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return itemPeriodEnd ?? null;
}

function getUserIdFromSubscription(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata?.userId;

  if (!metadataUserId) {
    return null;
  }

  const parsed = Number(metadataUserId);
  return Number.isFinite(parsed) ? parsed : null;
}

export class UnmappedStripeSubscriptionError extends Error {
  constructor(message = "Unable to map Stripe subscription to an OpenHouse user") {
    super(message);
    this.name = "UnmappedStripeSubscriptionError";
  }
}

type SyncSubscriptionOptions = {
  fallbackUserId?: number | null;
  fallbackCustomerId?: string | null;
};

async function findUserForSubscription(
  subscription: Stripe.Subscription,
  options: SyncSubscriptionOptions = {}
) {
  const db = getDb();
  const metadataUserId = getUserIdFromSubscription(subscription) ?? options.fallbackUserId ?? null;

  if (metadataUserId) {
    const [user] = await db.select().from(users).where(eq(users.id, metadataUserId)).limit(1);
    if (user) {
      return user;
    }
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? options.fallbackCustomerId ?? null;

  if (!customerId) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  return user ?? null;
}

export async function syncSubscriptionState(
  subscription: Stripe.Subscription,
  options: SyncSubscriptionOptions = {}
) {
  const db = getDb();
  const user = await findUserForSubscription(subscription, options);

  if (!user) {
    throw new UnmappedStripeSubscriptionError();
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const priceId = getSubscriptionPriceId(subscription);
  const configuredProPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const isActiveSubscription =
    subscription.status === "active" || subscription.status === "trialing";
  const subscriptionTier: PlanTier =
    isActiveSubscription && configuredProPriceId && priceId === configuredProPriceId
      ? "pro"
      : "free";
  const effectiveTier = resolvePlanTier({
    subscriptionTier,
    email: user.email,
  });
  const usageEntitlements = getPlanUsageEntitlements(effectiveTier);
  const periodEnd = getSubscriptionPeriodEnd(subscription)
    ? new Date(getSubscriptionPeriodEnd(subscription)! * 1000)
    : getDefaultUsageResetAt(effectiveTier);

  await db
    .update(users)
    .set({
      subscriptionTier,
      ...usageEntitlements,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      usageResetAt: periodEnd,
      pdlCreditsUsed: 0,
      aiQueriesUsed: 0,
    })
    .where(eq(users.id, user.id));

  if (effectiveTier === "free") {
    await db.update(events).set({ aiQaEnabled: false }).where(eq(events.userId, user.id));
    if (user.followUpEmailMode === "custom_domain") {
      await db.update(users).set({ followUpEmailMode: "draft" }).where(eq(users.id, user.id));
    }
  }
}

export async function downgradeUserToFreeByCustomer(customerId: string) {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      followUpEmailMode: users.followUpEmailMode,
    })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  const effectiveTier = resolvePlanTier({
    subscriptionTier: "free",
    email: user?.email,
  });
  const entitlements = getPlanUsageEntitlements(effectiveTier);

  await db
    .update(users)
    .set({
      subscriptionTier: "free",
      ...entitlements,
      stripeCustomerId: customerId,
      stripeSubscriptionId: null,
      usageResetAt: getDefaultUsageResetAt(effectiveTier),
      pdlCreditsUsed: 0,
      aiQueriesUsed: 0,
    })
    .where(eq(users.stripeCustomerId, customerId));

  if (user && effectiveTier === "free") {
    await db.update(events).set({ aiQaEnabled: false }).where(eq(events.userId, user.id));
    if (user.followUpEmailMode === "custom_domain") {
      await db.update(users).set({ followUpEmailMode: "draft" }).where(eq(users.id, user.id));
    }
  }
}

export function isBillingEnabledForUser(user: Pick<User, "subscriptionTier" | "email">) {
  return resolvePlanTier(user) === "pro";
}
