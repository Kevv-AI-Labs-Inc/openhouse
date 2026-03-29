import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function createDbMock({
  selectResults,
  insertError,
}: {
  selectResults: unknown[][];
  insertError?: Error;
}) {
  const insertValues: unknown[] = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockImplementation(() => Promise.resolve(selectResults.shift() ?? [])),
      })),
    })),
  }));
  const insert = vi.fn(() => ({
    values: vi.fn().mockImplementation((values: unknown) => {
      insertValues.push(values);
      return {
        onDuplicateKeyUpdate: vi.fn().mockImplementation(() => {
          if (insertError) {
            return Promise.reject(insertError);
          }
          return Promise.resolve(undefined);
        }),
      };
    }),
  }));

  return {
    db: { select, insert },
    insert,
    insertValues,
  };
}

async function importRouteWithMocks(db: ReturnType<typeof createDbMock>["db"], trusted = true) {
  const isTrustedPublicFunnelRequest = vi.fn(() => trusted);
  const checkRateLimit = vi.fn().mockResolvedValue({ ok: true });

  vi.doMock("@/lib/db", () => ({
    getDb: vi.fn(() => db),
  }));
  vi.doMock("@/lib/db/schema", () => ({
    events: {
      id: "id",
      uuid: "uuid",
    },
    publicFunnelEvents: {
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn(() => "eq"),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  }));
  vi.doMock("@/lib/public-funnel", () => ({
    buildPublicFunnelVisitorCookie: vi.fn(() => ({
      name: "visitor-cookie",
      value: "visitor-1",
    })),
    buildPublicFunnelStageCookie: vi.fn(() => ({
      name: "stage-cookie",
      value: "form_start",
    })),
    getPublicFunnelVisitorId: vi.fn(() => "visitor-1"),
    hasPublicFunnelStageCookie: vi.fn(() => false),
    isTrustedPublicFunnelRequest,
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    checkRateLimit,
    getClientIp: vi.fn(() => "127.0.0.1"),
  }));
  vi.doMock("@/lib/site", () => ({
    getSiteUrl: vi.fn(() => "https://openhouse.kevv.ai"),
  }));

  const route = await import("@/app/api/public/event/[uuid]/funnel/route");
  return { ...route, isTrustedPublicFunnelRequest, checkRateLimit };
}

describe("public funnel route critical", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns success instead of 500 when funnel tracking writes fail", async () => {
    const dbState = createDbMock({
      selectResults: [[{ id: 12 }]],
      insertError: new Error("missing table"),
    });
    const { POST } = await importRouteWithMocks(dbState.db);
    const request = new NextRequest("http://localhost:3000/api/public/event/evt-1/funnel", {
      method: "POST",
      body: JSON.stringify({ stage: "form_start" }),
      headers: {
        "content-type": "application/json",
        origin: "https://openhouse.kevv.ai",
        referer: "https://openhouse.kevv.ai/oh/evt-1",
      },
    });

    const response = await POST(request, { params: Promise.resolve({ uuid: "evt-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(dbState.insert).toHaveBeenCalledTimes(1);
  });

  it("bypasses database writes for untrusted origins", async () => {
    const dbState = createDbMock({
      selectResults: [[{ id: 12 }]],
    });
    const { POST } = await importRouteWithMocks(dbState.db, false);
    const request = new NextRequest("http://localhost:3000/api/public/event/evt-1/funnel", {
      method: "POST",
      body: JSON.stringify({ stage: "page_view" }),
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        referer: "https://evil.example/oh/evt-1",
      },
    });

    const response = await POST(request, { params: Promise.resolve({ uuid: "evt-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(dbState.insert).not.toHaveBeenCalled();
  });
});
