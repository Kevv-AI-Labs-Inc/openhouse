import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function createDbMock(existingEvent: Record<string, unknown>) {
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([existingEvent]),
      })),
    })),
  }));
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: updateWhere,
    })),
  }));

  return {
    db: { select, update },
    updateWhere,
  };
}

async function importRouteWithMocks(existingEvent: Record<string, unknown>) {
  const dbState = createDbMock(existingEvent);

  vi.doMock("@/lib/auth", () => ({
    auth: vi.fn().mockResolvedValue({
      user: {
        id: "7",
        subscriptionTier: "pro",
      },
    }),
  }));
  vi.doMock("@/lib/db", () => ({
    getDb: vi.fn(() => dbState.db),
  }));
  vi.doMock("@/lib/db/schema", () => ({
    events: {
      id: "id",
      userId: "userId",
      propertyAddress: "propertyAddress",
    },
    publicChatAccessGrants: { eventId: "eventId" },
    signIns: { eventId: "eventId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    and: vi.fn(() => "and"),
    eq: vi.fn(() => "eq"),
  }));
  vi.doMock("@/lib/billing", () => ({
    allocateTrialProLaunch: vi.fn().mockResolvedValue(undefined),
    hasProFeatureAccess: vi.fn().mockReturnValue(true),
    normalizePlanTier: vi.fn().mockReturnValue("pro"),
  }));
  vi.doMock("@/lib/ai/openai", () => ({
    hasAiConfiguration: vi.fn(() => true),
  }));
  vi.doMock("@/lib/property-qa-insights", () => ({
    getPropertyQaInsights: vi.fn(() => ({
      score: 58,
      level: "partial",
      readyCount: 4,
      totalCount: 8,
      categories: [],
      missingLabels: ["Building amenities"],
      suggestedQuestions: ["What amenities come with the property?"],
      publishReadiness: {
        status: "review",
        label: "Needs review",
        summary: "Coverage is usable, but still has visible buyer-facing gaps.",
        warnings: ["Public AI chat can launch, but it still has visible gaps in building amenities."],
        recommendedActions: ["Add amenities, laundry, parking, pet, and service details."],
      },
    })),
  }));

  const route = await import("@/app/api/events/[id]/route");
  return { ...route, dbState };
}

describe("event update route critical", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns publish-time QA warnings when AI chat is enabled on a published listing", async () => {
    const { PUT, dbState } = await importRouteWithMocks({
      id: 12,
      userId: 7,
      status: "draft",
      propertyAddress: "123 Main St",
      listPrice: "1250000",
      propertyDescription: "Bright condo",
      bedrooms: 2,
      bathrooms: "2",
      sqft: 1200,
      yearBuilt: 2008,
      aiQaContext: null,
      aiQaEnabled: false,
      featureAccessTier: "pro",
      proTrialExpiresAt: null,
    });

    const request = new NextRequest("http://localhost:3000/api/events/12", {
      method: "PUT",
      body: JSON.stringify({
        status: "active",
        aiQaEnabled: true,
        propertyAddress: "123 Main St",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      warnings: ["Public AI chat can launch, but it still has visible gaps in building amenities."],
      qaCoverage: {
        publishReadiness: {
          status: "review",
        },
      },
    });
    expect(dbState.updateWhere).toHaveBeenCalledTimes(1);
  });
});
