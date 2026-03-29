import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function createDbMock({
  selectResults,
  insertResults,
}: {
  selectResults: unknown[][];
  insertResults: Array<unknown[] | Error>;
}) {
  const insertedValues: unknown[] = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
      })),
    })),
  }));
  const insert = vi.fn(() => ({
    values: vi.fn().mockImplementation((values: unknown) => {
      insertedValues.push(values);
      const nextResult = insertResults.shift();
      if (nextResult instanceof Error) {
        return Promise.reject(nextResult);
      }
      return Promise.resolve(nextResult ?? [{ insertId: 1 }]);
    }),
  }));
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: updateWhere,
    })),
  }));

  return {
    db: { select, insert, update },
    insert,
    insertedValues,
    updateWhere,
  };
}

async function importRouteWithMocks(db: ReturnType<typeof createDbMock>["db"]) {
  const checkRateLimit = vi.fn().mockResolvedValue({ ok: true });
  const issuePublicChatAccessGrant = vi.fn();
  const processSignInWithAi = vi.fn().mockResolvedValue(undefined);
  const upsertFollowUpDraft = vi.fn().mockResolvedValue(undefined);

  vi.doMock("@/lib/db", () => ({
    getDb: vi.fn(() => db),
  }));
  vi.doMock("@/lib/db/schema", () => ({
    events: {
      id: "id",
      uuid: "uuid",
      userId: "userId",
      totalSignIns: "totalSignIns",
      featureAccessTier: "featureAccessTier",
      proTrialExpiresAt: "proTrialExpiresAt",
    },
    signIns: {
      id: "id",
      eventId: "eventId",
      clientSubmissionId: "clientSubmissionId",
    },
    users: {
      id: "id",
      email: "email",
      subscriptionTier: "subscriptionTier",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    and: vi.fn(() => "and"),
    eq: vi.fn(() => "eq"),
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
      { raw: vi.fn() }
    ),
  }));
  vi.doMock("@/lib/ai/process-signin", () => ({
    processSignInWithAi,
  }));
  vi.doMock("@/lib/plans", () => ({
    PLAN_LIMITS: {
      free: {
        maxSignInsPerMonth: 150,
      },
    },
    hasUsageCap: vi.fn(() => true),
  }));
  vi.doMock("@/lib/billing", () => ({
    countSignInsThisMonth: vi.fn().mockResolvedValue(0),
    ensureUsageWindow: vi.fn().mockResolvedValue({
      id: 7,
      email: "owner@example.com",
      subscriptionTier: "free",
    }),
    hasProFeatureAccess: vi.fn().mockReturnValue(false),
    normalizePlanTier: vi.fn().mockReturnValue("free"),
    resolveFeatureAccessTier: vi.fn().mockReturnValue("free"),
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit,
    getClientIp: vi.fn(() => "127.0.0.1"),
  }));
  vi.doMock("@/lib/ai/openai", () => ({
    hasAiConfiguration: vi.fn(() => false),
  }));
  vi.doMock("@/lib/public-chat-access", () => ({
    issuePublicChatAccessGrant,
    resolvePublicChatAccessGrant: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/lib/public-listing-view", () => ({
    buildPublicListingMarketing: vi.fn(() => ({
      headline: null,
      summary: null,
      highlights: [],
    })),
  }));
  vi.doMock("@/lib/ai/follow-up-workflow", () => ({
    upsertFollowUpDraft,
  }));
  vi.doMock("@/lib/public-mode", () => ({
    isPublicEventVisible: vi.fn(() => true),
  }));
  vi.doMock("@/lib/property-qa-language", () => ({
    detectPreferredQaLanguage: vi.fn(() => "en"),
  }));
  vi.doMock("@/lib/property-qa-insights", () => ({
    getPropertyQaInsights: vi.fn(() => ({
      suggestedQuestions: [],
    })),
  }));

  const route = await import("@/app/api/public/event/[uuid]/route");
  return { ...route, checkRateLimit, issuePublicChatAccessGrant, processSignInWithAi, upsertFollowUpDraft };
}

describe("public sign-in route critical", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retries a legacy insert when production is missing clientSubmissionId", async () => {
    const dbState = createDbMock({
      selectResults: [
        [
          {
            id: 12,
            uuid: "evt-1",
            userId: 7,
            status: "active",
            publicMode: "open_house",
            aiQaEnabled: false,
            featureAccessTier: "free",
            proTrialExpiresAt: null,
          },
        ],
        [
          {
            id: 7,
            email: "owner@example.com",
            subscriptionTier: "free",
          },
        ],
      ],
      insertResults: [
        Object.assign(new Error("Unknown column 'clientSubmissionId' in 'field list'"), {
          code: "ER_BAD_FIELD_ERROR",
          errno: 1054,
        }),
        [{ insertId: 44 }],
      ],
    });
    const { POST } = await importRouteWithMocks(dbState.db);
    const request = new NextRequest("http://localhost:3000/api/public/event/evt-1", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Taylor Buyer",
        phone: "555-123-4567",
        email: "taylor@example.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ uuid: "evt-1" }) });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      signInId: 44,
      featureAccessTier: "free",
    });
    expect(dbState.insertedValues).toHaveLength(2);
    expect(dbState.insertedValues[0]).toMatchObject({
      clientSubmissionId: null,
      fullName: "Taylor Buyer",
    });
    expect(dbState.insertedValues[1]).not.toHaveProperty("clientSubmissionId");
    expect(dbState.updateWhere).toHaveBeenCalledTimes(1);
  });

  it("short-circuits as deduplicated when the same kiosk submission already exists", async () => {
    const dbState = createDbMock({
      selectResults: [
        [
          {
            id: 12,
            uuid: "evt-1",
            userId: 7,
            status: "active",
            publicMode: "open_house",
            aiQaEnabled: false,
            featureAccessTier: "free",
            proTrialExpiresAt: null,
          },
        ],
        [
          {
            id: 7,
            email: "owner@example.com",
            subscriptionTier: "free",
          },
        ],
        [{ id: 91 }],
      ],
      insertResults: [],
    });
    const { POST } = await importRouteWithMocks(dbState.db);
    const request = new NextRequest("http://localhost:3000/api/public/event/evt-1", {
      method: "POST",
      body: JSON.stringify({
        clientSubmissionId: "2f0d5a57-a32d-495d-9e9c-6540f8d955ca",
        fullName: "Taylor Buyer",
        phone: "555-123-4567",
        email: "taylor@example.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ uuid: "evt-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      signInId: 91,
      deduplicated: true,
    });
    expect(dbState.insert).not.toHaveBeenCalled();
  });

  it("deduplicates cleanly when a concurrent insert hits the unique clientSubmissionId index", async () => {
    const dbState = createDbMock({
      selectResults: [
        [
          {
            id: 12,
            uuid: "evt-1",
            userId: 7,
            status: "active",
            publicMode: "open_house",
            aiQaEnabled: false,
            featureAccessTier: "free",
            proTrialExpiresAt: null,
          },
        ],
        [
          {
            id: 7,
            email: "owner@example.com",
            subscriptionTier: "free",
          },
        ],
        [],
        [{ id: 92 }],
      ],
      insertResults: [
        Object.assign(new Error("Duplicate entry"), {
          code: "ER_DUP_ENTRY",
          errno: 1062,
        }),
      ],
    });
    const { POST } = await importRouteWithMocks(dbState.db);
    const request = new NextRequest("http://localhost:3000/api/public/event/evt-1", {
      method: "POST",
      body: JSON.stringify({
        clientSubmissionId: "2f0d5a57-a32d-495d-9e9c-6540f8d955ca",
        fullName: "Taylor Buyer",
        phone: "555-123-4567",
        email: "taylor@example.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ uuid: "evt-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      signInId: 92,
      deduplicated: true,
    });
  });
});
