import { afterEach, describe, expect, it } from "vitest";
import {
  buildKevvSyncPayload,
  getKevvSyncConfig,
} from "@/lib/kevv-sync";

const envSnapshot = {
  KEVV_SYNC_BASE_URL: process.env.KEVV_SYNC_BASE_URL,
  KEVV_SYNC_TOKEN: process.env.KEVV_SYNC_TOKEN,
  KEVV_SYNC_PATH: process.env.KEVV_SYNC_PATH,
  KEVV_SYNC_TIMEOUT_MS: process.env.KEVV_SYNC_TIMEOUT_MS,
  KEVV_BASE_URL: process.env.KEVV_BASE_URL,
  APP_KEVV_URL: process.env.APP_KEVV_URL,
  KEVV_INTERNAL_API_TOKEN: process.env.KEVV_INTERNAL_API_TOKEN,
};

afterEach(() => {
  Object.entries(envSnapshot).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
});

describe("kevv sync smoke", () => {
  it("enables sync when base URL and token are configured", () => {
    process.env.KEVV_SYNC_BASE_URL = "https://app.kevv.ai";
    process.env.KEVV_SYNC_TOKEN = "test-token";
    process.env.KEVV_SYNC_PATH = "/api/internal/openhouse/signins";
    process.env.KEVV_SYNC_TIMEOUT_MS = "9000";

    const config = getKevvSyncConfig();

    expect(config.enabled).toBe(true);
    expect(config.baseUrl).toBe("https://app.kevv.ai");
    expect(config.path).toBe("/api/internal/openhouse/signins");
    expect(config.timeoutMs).toBe(9000);
  });

  it("builds a payload with event mapping first and owner mapping as fallback", () => {
    const payload = buildKevvSyncPayload({
      signIn: {
        id: 41,
        eventId: 9,
        fullName: "Taylor Buyer",
        email: "taylor@example.com",
        phone: "555-123-4567",
        captureMode: "open_house",
        hasAgent: false,
        isPreApproved: "no",
        interestLevel: "somewhat",
        buyingTimeline: "3_6_months",
        priceRange: "$1.0M-$1.5M",
        customAnswers: { parking: "Need 1 spot" },
        leadScore: { overallScore: 72 },
        leadTier: "warm",
        aiRecommendation: "Follow up within 24 hours.",
        followUpSent: true,
        followUpSentAt: new Date("2026-03-29T12:00:00.000Z"),
        kevvContactId: null,
        crmSyncStatus: "pending",
        signedInAt: new Date("2026-03-29T10:00:00.000Z"),
      },
      event: {
        id: 9,
        uuid: "evt-123",
        propertyAddress: "123 Main St",
        listPrice: "1250000",
        publicMode: "open_house",
        kevvAgentId: 88,
        kevvCompanyId: null,
      },
      owner: {
        id: 7,
        email: "agent@example.com",
        kevvAgentId: 55,
        kevvCompanyId: 22,
      },
    });

    expect(payload.agentId).toBe(88);
    expect(payload.companyId).toBe(22);
    expect(payload.followUp.sent).toBe(true);
    expect(payload.owner.email).toBe("agent@example.com");
    expect(payload.contact.fullName).toBe("Taylor Buyer");
  });
});
