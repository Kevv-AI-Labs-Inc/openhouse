/**
 * API Contract Tests
 *
 * Validates that API route modules export the correct HTTP method handlers
 * with the right function signatures. Catches broken routes before deploy.
 */
import { describe, expect, it, vi, afterEach } from "vitest";

describe("API route contract: /api/events", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exports GET and POST handlers", async () => {
    vi.doMock("@/lib/db", () => ({
      getDb: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn(),
    }));

    const mod = await import("@/app/api/events/route");

    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });
});

describe("API route contract: /api/public/event/[uuid]", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exports GET and POST handlers", async () => {
    vi.doMock("@/lib/db", () => ({
      getDb: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn(),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ ok: true }),
      getClientIp: vi.fn(() => "127.0.0.1"),
    }));
    vi.doMock("@/lib/billing", () => ({
      countSignInsThisMonth: vi.fn().mockResolvedValue(0),
      ensureUsageWindow: vi.fn().mockResolvedValue({ id: 1, email: "test@test.com", subscriptionTier: "free" }),
      hasProFeatureAccess: vi.fn().mockReturnValue(false),
      normalizePlanTier: vi.fn().mockReturnValue("free"),
      resolveFeatureAccessTier: vi.fn().mockReturnValue("free"),
    }));
    vi.doMock("@/lib/plans", () => ({
      PLAN_LIMITS: { free: { maxSignInsPerMonth: 150 } },
      hasUsageCap: vi.fn(() => true),
    }));
    vi.doMock("@/lib/ai/process-signin", () => ({
      processSignInWithAi: vi.fn(),
    }));
    vi.doMock("@/lib/ai/openai", () => ({
      hasAiConfiguration: vi.fn(() => false),
    }));
    vi.doMock("@/lib/public-chat-access", () => ({
      issuePublicChatAccessGrant: vi.fn(),
      resolvePublicChatAccessGrant: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/public-listing-view", () => ({
      buildPublicListingMarketing: vi.fn(() => ({ headline: null, summary: null, highlights: [] })),
    }));
    vi.doMock("@/lib/ai/follow-up-workflow", () => ({
      upsertFollowUpDraft: vi.fn(),
    }));
    vi.doMock("@/lib/public-mode", () => ({
      isPublicEventVisible: vi.fn(() => true),
    }));
    vi.doMock("@/lib/property-qa-language", () => ({
      detectPreferredQaLanguage: vi.fn(() => "en"),
    }));
    vi.doMock("@/lib/property-qa-insights", () => ({
      getPropertyQaInsights: vi.fn(() => ({ suggestedQuestions: [] })),
    }));
    vi.doMock("@/lib/db/schema", () => ({
      events: { id: "id", uuid: "uuid", userId: "userId", totalSignIns: "totalSignIns", featureAccessTier: "featureAccessTier", proTrialExpiresAt: "proTrialExpiresAt" },
      signIns: { id: "id", eventId: "eventId", clientSubmissionId: "clientSubmissionId" },
      users: { id: "id", email: "email", subscriptionTier: "subscriptionTier" },
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(() => "and"),
      eq: vi.fn(() => "eq"),
      sql: Object.assign((s: TemplateStringsArray) => ({ s }), { raw: vi.fn() }),
    }));

    const mod = await import("@/app/api/public/event/[uuid]/route");

    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });
});

describe("API route contract: /api/billing/status", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exports a GET handler", async () => {
    vi.doMock("@/lib/db", () => ({
      getDb: vi.fn(),
    }));
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn(),
    }));

    const mod = await import("@/app/api/billing/status/route");

    expect(typeof mod.GET).toBe("function");
  });
});

describe("API route contract: /api/public/event/[uuid]/funnel", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("exports a POST handler", async () => {
    vi.doMock("@/lib/db", () => ({
      getDb: vi.fn(),
    }));

    const mod = await import("@/app/api/public/event/[uuid]/funnel/route");

    expect(typeof mod.POST).toBe("function");
  });
});
