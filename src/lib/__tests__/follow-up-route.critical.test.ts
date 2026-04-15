import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

type DeliveryMode = "draft" | "google" | "microsoft" | "custom_domain";

function createDbMock(selectResults: unknown[][]) {
  const updates: Array<{ table: string; value: unknown }> = [];
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
  const update = vi.fn((table: string) => ({
    set: vi.fn((value: unknown) => {
      updates.push({ table, value });
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    }),
  }));

  return {
    db: { select, update },
    updates,
  };
}

function buildEvent() {
  return {
    id: 12,
    userId: 7,
    propertyAddress: "123 Main St",
    propertyType: "condo",
    listPrice: "950000",
    featureAccessTier: "pro",
    proTrialExpiresAt: null,
  };
}

function buildAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    fullName: "Alex Agent",
    email: "agent@example.com",
    subscriptionTier: "pro",
    followUpEmailMode: "draft",
    gmailRefreshTokenEncrypted: null,
    gmailSendAsEmail: null,
    gmailSendingEnabled: false,
    microsoftRefreshTokenEncrypted: null,
    microsoftSendAsEmail: null,
    microsoftSendingEnabled: false,
    customSendingDomain: null,
    customSendingDomainStatus: "not_started",
    customSendingFromEmail: null,
    customSendingFromName: null,
    customSendingReplyToEmail: null,
    ...overrides,
  };
}

function buildSignIn(overrides: Record<string, unknown> = {}) {
  return {
    id: 44,
    eventId: 12,
    fullName: "Taylor Buyer",
    email: "taylor@example.com",
    phone: "555-123-4567",
    interestLevel: "very",
    buyingTimeline: "0_3_months",
    hasAgent: false,
    isPreApproved: "yes",
    leadScore: null,
    leadTier: "hot",
    followUpSent: false,
    followUpContent: null,
    ...overrides,
  };
}

async function importRouteWithMocks({
  selectResults,
  activeMode,
}: {
  selectResults: unknown[][];
  activeMode: DeliveryMode;
}) {
  const auth = vi.fn().mockResolvedValue({
    user: {
      id: "7",
      subscriptionTier: "pro",
    },
  });
  const dbState = createDbMock(selectResults);
  const generateFollowUpEmail = vi.fn().mockResolvedValue({
    subject: "Thanks for visiting 123 Main St",
    body: "It was great meeting you at the open house.",
    tokensUsed: 120,
  });
  const sendViaGmail = vi.fn().mockResolvedValue(undefined);
  const sendViaMicrosoft = vi.fn().mockResolvedValue(undefined);
  const sendViaCustomDomainRelay = vi.fn().mockResolvedValue(undefined);
  const markSignInPendingKevvSync = vi.fn().mockResolvedValue(true);

  vi.doMock("@/lib/auth", () => ({ auth }));
  vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => dbState.db) }));
  vi.doMock("@/lib/db/schema", () => ({
    events: {
      id: "id",
      userId: "userId",
      featureAccessTier: "featureAccessTier",
      proTrialExpiresAt: "proTrialExpiresAt",
    },
    signIns: {
      id: "id",
      eventId: "eventId",
      followUpSent: "followUpSent",
    },
    users: {
      id: "id",
      fullName: "fullName",
      email: "email",
      subscriptionTier: "subscriptionTier",
      followUpEmailMode: "followUpEmailMode",
      gmailRefreshTokenEncrypted: "gmailRefreshTokenEncrypted",
      gmailSendAsEmail: "gmailSendAsEmail",
      gmailSendingEnabled: "gmailSendingEnabled",
      microsoftRefreshTokenEncrypted: "microsoftRefreshTokenEncrypted",
      microsoftSendAsEmail: "microsoftSendAsEmail",
      microsoftSendingEnabled: "microsoftSendingEnabled",
      customSendingDomain: "customSendingDomain",
      customSendingDomainStatus: "customSendingDomainStatus",
      customSendingFromEmail: "customSendingFromEmail",
      customSendingFromName: "customSendingFromName",
      customSendingReplyToEmail: "customSendingReplyToEmail",
      gmailLastSendError: "gmailLastSendError",
      microsoftLastSendError: "microsoftLastSendError",
      customSendingLastError: "customSendingLastError",
      gmailConnectedAt: "gmailConnectedAt",
      microsoftConnectedAt: "microsoftConnectedAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    and: vi.fn(() => "and"),
    eq: vi.fn(() => "eq"),
    inArray: vi.fn(() => "inArray"),
  }));
  vi.doMock("@/lib/ai/follow-up", () => ({
    generateFollowUpEmail,
  }));
  vi.doMock("@/lib/billing", () => ({
    hasProFeatureAccess: vi.fn(() => true),
  }));
  vi.doMock("@/lib/gmail", () => ({
    GmailIntegrationError: class GmailIntegrationError extends Error {},
    isGmailDirectSendAvailable: vi.fn(() => true),
    sendViaGmail,
  }));
  vi.doMock("@/lib/microsoft", () => ({
    MicrosoftIntegrationError: class MicrosoftIntegrationError extends Error {},
    isMicrosoftDirectSendAvailable: vi.fn(() => true),
    sendViaMicrosoft,
  }));
  vi.doMock("@/lib/email", () => ({
    isEmailRelayConfigured: vi.fn(() => true),
    sendViaCustomDomainRelay,
  }));
  vi.doMock("@/lib/follow-up-email", () => ({
    resolveEffectiveFollowUpMode: vi.fn(() => activeMode),
  }));
  vi.doMock("@/lib/follow-up-draft", () => ({
    parseStoredFollowUpDraft: vi.fn(() => null),
    serializeStoredFollowUpDraft: vi.fn((draft: unknown) => JSON.stringify(draft)),
  }));
  vi.doMock("@/lib/kevv-sync", () => ({
    markSignInPendingKevvSync,
  }));

  const route = await import("@/app/api/events/[id]/follow-up/route");
  return {
    ...route,
    dbState,
    auth,
    generateFollowUpEmail,
    sendViaGmail,
    sendViaMicrosoft,
    sendViaCustomDomainRelay,
    markSignInPendingKevvSync,
  };
}

describe("follow-up route critical", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("stores a draft without calling any delivery provider when send=false", async () => {
    const { POST, dbState, sendViaGmail, sendViaMicrosoft, sendViaCustomDomainRelay } =
      await importRouteWithMocks({
        activeMode: "google",
        selectResults: [[buildEvent()], [buildAgent()], [buildSignIn()]],
      });

    const request = new NextRequest("http://localhost:3000/api/events/12/follow-up", {
      method: "POST",
      body: JSON.stringify({ signInId: 44, send: false }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      count: 1,
      deliveryMode: "draft",
      results: [
        expect.objectContaining({
          signInId: 44,
          deliveryStatus: "draft",
          deliveryMode: "draft",
        }),
      ],
    });
    expect(sendViaGmail).not.toHaveBeenCalled();
    expect(sendViaMicrosoft).not.toHaveBeenCalled();
    expect(sendViaCustomDomainRelay).not.toHaveBeenCalled();
    const signInUpdate = dbState.updates.find(
      (item) =>
        item.table &&
        typeof item.table === "object" &&
        "followUpSent" in item.table
    );

    expect(signInUpdate).toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          followUpSent: false,
          followUpContent: expect.stringContaining('"deliveryMode":"draft"'),
        }),
      })
    );
  });

  it("sends through Gmail when google mode is active", async () => {
    const { POST, dbState, sendViaGmail, markSignInPendingKevvSync } =
      await importRouteWithMocks({
        activeMode: "google",
        selectResults: [
          [buildEvent()],
          [
            buildAgent({
              followUpEmailMode: "google",
              gmailRefreshTokenEncrypted: "encrypted-google-token",
              gmailSendAsEmail: "agent@gmail.com",
              gmailSendingEnabled: true,
            }),
          ],
          [buildSignIn()],
        ],
      });

    const request = new NextRequest("http://localhost:3000/api/events/12/follow-up", {
      method: "POST",
      body: JSON.stringify({ signInId: 44, send: true }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deliveryMode: "google",
      results: [
        expect.objectContaining({
          deliveryStatus: "sent",
          deliveryMode: "google",
        }),
      ],
    });
    expect(sendViaGmail).toHaveBeenCalledWith({
      refreshTokenEncrypted: "encrypted-google-token",
      senderEmail: "agent@gmail.com",
      to: "taylor@example.com",
      subject: "Thanks for visiting 123 Main St",
      text: "It was great meeting you at the open house.",
      replyTo: "agent@example.com",
    });
    expect(markSignInPendingKevvSync).toHaveBeenCalledWith(44);
    const signInUpdate = dbState.updates.find(
      (item) =>
        item.table &&
        typeof item.table === "object" &&
        "followUpSent" in item.table &&
        typeof item.value === "object" &&
        item.value !== null &&
        "followUpSent" in item.value
    );

    expect(signInUpdate).toEqual(
      expect.objectContaining({
        value: expect.objectContaining({
          followUpSent: true,
        }),
      })
    );
  });

  it("sends through Microsoft when microsoft mode is active", async () => {
    const { POST, sendViaMicrosoft } = await importRouteWithMocks({
      activeMode: "microsoft",
      selectResults: [
        [buildEvent()],
        [
          buildAgent({
            followUpEmailMode: "microsoft",
            microsoftRefreshTokenEncrypted: "encrypted-microsoft-token",
            microsoftSendAsEmail: "agent@outlook.com",
            microsoftSendingEnabled: true,
          }),
        ],
        [buildSignIn()],
      ],
    });

    const request = new NextRequest("http://localhost:3000/api/events/12/follow-up", {
      method: "POST",
      body: JSON.stringify({ signInId: 44, send: true }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deliveryMode: "microsoft",
      results: [
        expect.objectContaining({
          deliveryStatus: "sent",
          deliveryMode: "microsoft",
        }),
      ],
    });
    expect(sendViaMicrosoft).toHaveBeenCalledWith({
      refreshTokenEncrypted: "encrypted-microsoft-token",
      senderEmail: "agent@outlook.com",
      to: "taylor@example.com",
      subject: "Thanks for visiting 123 Main St",
      text: "It was great meeting you at the open house.",
      replyTo: "agent@example.com",
    });
  });

  it("sends through the verified team domain when custom-domain mode is active", async () => {
    const { POST, sendViaCustomDomainRelay } = await importRouteWithMocks({
      activeMode: "custom_domain",
      selectResults: [
        [buildEvent()],
        [
          buildAgent({
            followUpEmailMode: "custom_domain",
            customSendingDomain: "mail.brand.com",
            customSendingDomainStatus: "verified",
            customSendingFromEmail: "hello@mail.brand.com",
            customSendingFromName: "Brand Team",
            customSendingReplyToEmail: "agent@brand.com",
          }),
        ],
        [buildSignIn()],
      ],
    });

    const request = new NextRequest("http://localhost:3000/api/events/12/follow-up", {
      method: "POST",
      body: JSON.stringify({ signInId: 44, send: true }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ id: "12" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deliveryMode: "custom_domain",
      results: [
        expect.objectContaining({
          deliveryStatus: "sent",
          deliveryMode: "custom_domain",
        }),
      ],
    });
    expect(sendViaCustomDomainRelay).toHaveBeenCalledWith({
      to: "taylor@example.com",
      subject: "Thanks for visiting 123 Main St",
      text: "It was great meeting you at the open house.",
      fromEmail: "hello@mail.brand.com",
      fromName: "Brand Team",
      replyTo: "agent@brand.com",
    });
  });
});
