import { describe, expect, it } from "vitest";
import { isBehaviorQualifiedLead, type SellerReportSignIn } from "@/lib/seller-report";

function makeSignIn(
  leadScore: SellerReportSignIn["leadScore"] = null
): SellerReportSignIn {
  return {
    id: 1,
    fullName: "Test",
    phone: null,
    email: null,
    captureMode: null,
    hasAgent: false,
    isPreApproved: null,
    interestLevel: null,
    buyingTimeline: null,
    priceRange: null,
    leadTier: null,
    leadScore,
    signedInAt: new Date().toISOString(),
  };
}

describe("isBehaviorQualifiedLead", () => {
  it("returns false when leadScore is null", () => {
    expect(isBehaviorQualifiedLead(makeSignIn(null))).toBe(false);
  });

  it("returns false when leadScore has no behavior signals", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({ overallScore: 50, tier: "warm", signals: {} })
      )
    ).toBe(false);
  });

  it("returns false when behavior object is empty", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 50,
          tier: "warm",
          signals: {
            behavior: {},
          },
        })
      )
    ).toBe(false);
  });

  it("qualifies via strongIntent = true", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 90,
          tier: "hot",
          signals: {
            behavior: {
              strongIntent: true,
              userMessageCount: 0,
              sessionCount: 1,
            },
          },
        })
      )
    ).toBe(true);
  });

  it("qualifies via actionIntents array", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 70,
          tier: "warm",
          signals: {
            behavior: {
              strongIntent: false,
              userMessageCount: 0,
              sessionCount: 1,
              actionIntents: ["schedule_showing"],
            },
          },
        })
      )
    ).toBe(true);
  });

  it("qualifies via userMessageCount >= 2", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 60,
          tier: "warm",
          signals: {
            behavior: {
              strongIntent: false,
              userMessageCount: 2,
              sessionCount: 1,
            },
          },
        })
      )
    ).toBe(true);
  });

  it("qualifies via sessionCount >= 2", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 55,
          tier: "warm",
          signals: {
            behavior: {
              strongIntent: false,
              userMessageCount: 0,
              sessionCount: 2,
            },
          },
        })
      )
    ).toBe(true);
  });

  it("does not qualify with 1 session and 1 message and no strong intent", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 40,
          tier: "cold",
          signals: {
            behavior: {
              strongIntent: false,
              userMessageCount: 1,
              sessionCount: 1,
              actionIntents: [],
            },
          },
        })
      )
    ).toBe(false);
  });

  it("handles missing behavior subfields gracefully", () => {
    expect(
      isBehaviorQualifiedLead(
        makeSignIn({
          overallScore: 30,
          tier: "cold",
          signals: {
            behavior: {
              // intentionally sparse — no strongIntent, no counts
            },
          },
        })
      )
    ).toBe(false);
  });
});
