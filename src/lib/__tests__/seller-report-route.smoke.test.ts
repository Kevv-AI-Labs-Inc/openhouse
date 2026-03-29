import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("seller report route smoke", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/seller-report-data", () => ({
      buildSellerReportEventById: vi.fn(),
    }));

    const { GET } = await import("@/app/api/events/[id]/report/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events/12/report"),
      { params: Promise.resolve({ id: "12" }) }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 404 when the requested event is not found", async () => {
    const auth = vi.fn().mockResolvedValue({ user: { id: "7" } });
    const buildSellerReportEventById = vi.fn().mockResolvedValue(null);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    };

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => db) }));
    vi.doMock("@/lib/db/schema", () => ({
      events: {
        id: "id",
        userId: "userId",
        featureAccessTier: "featureAccessTier",
        proTrialExpiresAt: "proTrialExpiresAt",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(),
      eq: vi.fn(),
    }));
    vi.doMock("@/lib/billing", () => ({
      getSellerReportAccess: vi.fn().mockReturnValue("basic"),
    }));
    vi.doMock("@/lib/seller-report-data", () => ({
      buildSellerReportEventById,
    }));

    const { GET } = await import("@/app/api/events/[id]/report/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events/12/report"),
      { params: Promise.resolve({ id: "12" }) }
    );

    expect(auth).toHaveBeenCalledTimes(1);
    expect(buildSellerReportEventById).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("returns report access with the seller report payload", async () => {
    const auth = vi.fn().mockResolvedValue({
      user: {
        id: "7",
        email: "agent@example.com",
        subscriptionTier: "free",
      },
    });
    const buildSellerReportEventById = vi.fn().mockResolvedValue({
      id: 12,
      uuid: "abc",
      propertyAddress: "123 Main St",
      mlsNumber: null,
      listPrice: null,
      propertyType: null,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      publicMode: "open_house",
      status: "completed",
      totalSignIns: 0,
      hotLeadsCount: 0,
      bedrooms: null,
      bathrooms: null,
      sqft: null,
      signIns: [],
      funnelMetrics: {
        uniqueVisitors: 0,
        uniqueFormStarts: 0,
      },
      activitySeries: [],
      benchmark: null,
    });
    const getSellerReportAccess = vi.fn().mockReturnValue("basic");
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: 12,
                featureAccessTier: "free",
                proTrialExpiresAt: null,
              },
            ]),
          })),
        })),
      })),
    };

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => db) }));
    vi.doMock("@/lib/db/schema", () => ({
      events: {
        id: "id",
        userId: "userId",
        featureAccessTier: "featureAccessTier",
        proTrialExpiresAt: "proTrialExpiresAt",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      and: vi.fn(),
      eq: vi.fn(),
    }));
    vi.doMock("@/lib/billing", () => ({
      getSellerReportAccess,
    }));
    vi.doMock("@/lib/seller-report-data", () => ({
      buildSellerReportEventById,
    }));

    const { GET } = await import("@/app/api/events/[id]/report/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events/12/report"),
      { params: Promise.resolve({ id: "12" }) }
    );

    expect(buildSellerReportEventById).toHaveBeenCalledWith(12, 7);
    expect(getSellerReportAccess).toHaveBeenCalledWith({
      subscriptionTier: "free",
      accountEmail: "agent@example.com",
      eventFeatureAccessTier: "free",
      proTrialExpiresAt: null,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 12,
      reportAccess: "basic",
    });
  });
});
