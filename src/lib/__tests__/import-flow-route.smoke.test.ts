import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("import flow smoke", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when address import is unauthenticated", async () => {
    vi.doMock("@/lib/auth", () => ({
      auth: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/listing-import", () => ({
      searchListingsByAddress: vi.fn(),
    }));

    const { POST } = await import("@/app/api/import/address/route");
    const request = new NextRequest("http://localhost:3000/api/import/address", {
      method: "POST",
      body: JSON.stringify({ query: "123 Main St, New York, NY 10001" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("normalizes address input before querying the listing provider", async () => {
    const auth = vi.fn().mockResolvedValue({ user: { id: "9" } });
    const searchListingsByAddress = vi.fn().mockResolvedValue([]);

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/listing-import", () => ({
      searchListingsByAddress,
    }));

    const { POST } = await import("@/app/api/import/address/route");
    const request = new NextRequest("http://localhost:3000/api/import/address", {
      method: "POST",
      body: JSON.stringify({
        query: "  123 Main St, New York, NY 10001  ",
        city: "  New York ",
        state: " NY ",
        postalCode: " 10001 ",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(auth).toHaveBeenCalledTimes(1);
    expect(searchListingsByAddress).toHaveBeenCalledWith({
      query: "123 Main St, New York, NY 10001",
      address: "123 Main St, New York, NY 10001",
      city: "New York",
      state: "NY",
      postalCode: "10001",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ drafts: [] });
  });
});
