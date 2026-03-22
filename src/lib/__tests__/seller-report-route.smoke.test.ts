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

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/seller-report-data", () => ({
      buildSellerReportEventById,
    }));

    const { GET } = await import("@/app/api/events/[id]/report/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/events/12/report"),
      { params: Promise.resolve({ id: "12" }) }
    );

    expect(auth).toHaveBeenCalledTimes(1);
    expect(buildSellerReportEventById).toHaveBeenCalledWith(12, 7);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Event not found" });
  });
});
