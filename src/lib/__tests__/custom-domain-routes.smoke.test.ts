import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

function createDbMock(selectResults: unknown[][] = []) {
  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updates: unknown[] = [];
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => {
        const next = Promise.resolve(selectResults.shift() ?? []);
        return {
          limit: vi.fn(() => next),
          then: next.then.bind(next),
          catch: next.catch.bind(next),
          finally: next.finally.bind(next),
        };
      }),
    })),
  }));
  const update = vi.fn(() => ({
    set: vi.fn((value: unknown) => {
      updates.push(value);
      return {
        where: updateWhere,
      };
    }),
  }));

  return {
    db: { select, update },
    updates,
    updateWhere,
  };
}

describe("custom-domain routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("saves a verified custom domain config", async () => {
    const auth = vi.fn().mockResolvedValue({
      user: { id: "7", subscriptionTier: "pro" },
    });
    const dbState = createDbMock();

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => dbState.db) }));
    vi.doMock("@/lib/db/schema", () => ({
      users: { id: "id" },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(() => "eq"),
    }));
    vi.doMock("@/lib/email", () => ({
      isEmailRelayConfigured: vi.fn(() => true),
      lookupRelayDomain: vi.fn().mockResolvedValue({
        id: "domain_123",
        status: "verified",
      }),
      normalizeDomain: vi.fn((value: string) => value.trim().toLowerCase()),
    }));
    vi.doMock("@/lib/plans", () => ({
      isPro: vi.fn(() => true),
    }));

    const { POST } = await import("@/app/api/integrations/custom-domain/route");
    const request = new NextRequest("http://localhost:3000/api/integrations/custom-domain", {
      method: "POST",
      body: JSON.stringify({
        domain: "Mail.Brand.com",
        fromEmail: "hello@mail.brand.com",
        fromName: "Brand Team",
        replyToEmail: "agent@brand.com",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(auth).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      domain: "mail.brand.com",
      status: "verified",
      relayFound: true,
    });
    expect(dbState.updates[0]).toMatchObject({
      customSendingDomain: "mail.brand.com",
      customSendingDomainId: "domain_123",
      customSendingDomainStatus: "verified",
      customSendingFromEmail: "hello@mail.brand.com",
      customSendingFromName: "Brand Team",
      customSendingReplyToEmail: "agent@brand.com",
      customSendingLastError: null,
    });
  });

  it("sends a live test email once the domain is verified", async () => {
    const auth = vi.fn().mockResolvedValue({
      user: {
        id: "7",
        email: "agent@example.com",
        subscriptionTier: "pro",
      },
    });
    const dbState = createDbMock([
      [
        {
          customSendingDomain: "mail.brand.com",
          customSendingDomainStatus: "verified",
          customSendingFromEmail: "hello@mail.brand.com",
          customSendingFromName: "Brand Team",
          customSendingReplyToEmail: "agent@brand.com",
        },
      ],
    ]);
    const sendViaCustomDomainRelay = vi.fn().mockResolvedValue({ id: "email_123" });

    vi.doMock("@/lib/auth", () => ({ auth }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => dbState.db) }));
    vi.doMock("@/lib/db/schema", () => ({
      users: {
        id: "id",
        customSendingDomain: "customSendingDomain",
        customSendingDomainStatus: "customSendingDomainStatus",
        customSendingFromEmail: "customSendingFromEmail",
        customSendingFromName: "customSendingFromName",
        customSendingReplyToEmail: "customSendingReplyToEmail",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(() => "eq"),
    }));
    vi.doMock("@/lib/email", () => ({
      isEmailRelayConfigured: vi.fn(() => true),
      sendViaCustomDomainRelay,
    }));
    vi.doMock("@/lib/plans", () => ({
      isPro: vi.fn(() => true),
    }));

    const { POST } = await import("@/app/api/integrations/custom-domain/test/route");
    const request = new NextRequest("http://localhost:3000/api/integrations/custom-domain/test", {
      method: "POST",
      body: JSON.stringify({ toEmail: "qa@example.com" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      toEmail: "qa@example.com",
      domain: "mail.brand.com",
    });
    expect(sendViaCustomDomainRelay).toHaveBeenCalledWith({
      to: "qa@example.com",
      subject: "OpenHouse custom domain test",
      text: expect.stringContaining("mail.brand.com"),
      fromEmail: "hello@mail.brand.com",
      fromName: "Brand Team",
      replyTo: "agent@brand.com",
    });
    expect(dbState.updates[0]).toEqual({
      customSendingLastError: null,
    });
  });
});
