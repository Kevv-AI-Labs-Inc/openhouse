import { describe, expect, it } from "vitest";
import { buildSellerReportMetrics } from "@/lib/seller-report-metrics";
import type { SellerReportSignIn } from "@/lib/seller-report";

function makeSignIn(
  overrides: Partial<SellerReportSignIn & { inferredCaptureMode: "open_house" | "listing_inquiry" }> = {}
): SellerReportSignIn & { inferredCaptureMode: "open_house" | "listing_inquiry" } {
  return {
    id: 1,
    fullName: "Test Visitor",
    phone: "555-000-0000",
    email: "test@example.com",
    captureMode: null,
    hasAgent: false,
    isPreApproved: null,
    interestLevel: null,
    buyingTimeline: null,
    priceRange: null,
    leadTier: null,
    leadScore: null,
    signedInAt: new Date().toISOString(),
    inferredCaptureMode: "open_house",
    ...overrides,
  };
}

describe("buildSellerReportMetrics", () => {
  it("returns zeros for empty sign-ins", () => {
    const result = buildSellerReportMetrics({ signIns: [] });

    expect(result.uniqueVisitors).toBe(0);
    expect(result.uniqueFormStarts).toBe(0);
    expect(result.behaviorQualifiedLeads).toHaveLength(0);
    expect(result.warmLeads).toHaveLength(0);
    expect(result.withAgent).toBe(0);
    expect(result.preApproved).toBe(0);
    expect(result.noAgent).toBe(0);
    expect(result.openHouseCaptures).toBe(0);
    expect(result.listingInquiryCaptures).toBe(0);
    expect(result.scoredLeadCount).toBe(0);
    expect(result.averageLeadScore).toBe(0);
    expect(result.uniqueVisitorCaptureRate).toBeNull();
    expect(result.uniqueFormCompletionRate).toBeNull();
    expect(result.directBuyerPercent).toBe(0);
    expect(result.inquiryShare).toBe(0);
    expect(result.onSiteShare).toBe(0);
  });

  it("computes capture rate from funnel metrics", () => {
    const signIns = [makeSignIn(), makeSignIn({ id: 2 }), makeSignIn({ id: 3 })];
    const result = buildSellerReportMetrics({
      signIns,
      funnelMetrics: { uniqueVisitors: 10, uniqueFormStarts: 5 },
    });

    expect(result.uniqueVisitorCaptureRate).toBe(30); // 3/10 = 30%
    expect(result.uniqueFormCompletionRate).toBe(60); // 3/5 = 60%
  });

  it("returns null rates when funnel has zero visitors", () => {
    const result = buildSellerReportMetrics({
      signIns: [makeSignIn()],
      funnelMetrics: { uniqueVisitors: 0, uniqueFormStarts: 0 },
    });

    expect(result.uniqueVisitorCaptureRate).toBeNull();
    expect(result.uniqueFormCompletionRate).toBeNull();
  });

  it("counts agent and pre-approval status correctly", () => {
    const signIns = [
      makeSignIn({ id: 1, hasAgent: true, isPreApproved: "yes" }),
      makeSignIn({ id: 2, hasAgent: true, isPreApproved: "no" }),
      makeSignIn({ id: 3, hasAgent: false, isPreApproved: "yes" }),
      makeSignIn({ id: 4, hasAgent: false, isPreApproved: null }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.withAgent).toBe(2);
    expect(result.preApproved).toBe(2);
    expect(result.noAgent).toBe(2);
    expect(result.directBuyerPercent).toBe(50);
  });

  it("separates open house vs listing inquiry captures", () => {
    const signIns = [
      makeSignIn({ id: 1, inferredCaptureMode: "open_house" }),
      makeSignIn({ id: 2, inferredCaptureMode: "open_house" }),
      makeSignIn({ id: 3, inferredCaptureMode: "listing_inquiry" }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.openHouseCaptures).toBe(2);
    expect(result.listingInquiryCaptures).toBe(1);
    expect(result.onSiteShare).toBe(67); // 2/3 ≈ 67%
    expect(result.inquiryShare).toBe(33); // 1/3 ≈ 33%
  });

  it("counts warm leads by leadTier", () => {
    const signIns = [
      makeSignIn({ id: 1, leadTier: "warm" }),
      makeSignIn({ id: 2, leadTier: "warm" }),
      makeSignIn({ id: 3, leadTier: "cold" }),
      makeSignIn({ id: 4, leadTier: null }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.warmLeads).toHaveLength(2);
  });

  it("calculates average lead score only from scored leads", () => {
    const signIns = [
      makeSignIn({ id: 1, leadScore: { overallScore: 80, tier: "hot" } }),
      makeSignIn({ id: 2, leadScore: { overallScore: 60, tier: "warm" } }),
      makeSignIn({ id: 3, leadScore: null }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.scoredLeadCount).toBe(2);
    expect(result.averageLeadScore).toBe(70); // (80+60)/2
  });

  it("identifies behavior-qualified leads through strong intent", () => {
    const signIns = [
      makeSignIn({
        id: 1,
        leadScore: {
          overallScore: 90,
          tier: "hot",
          signals: { behavior: { strongIntent: true, userMessageCount: 0, sessionCount: 1 } },
        },
      }),
      makeSignIn({ id: 2, leadScore: null }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.behaviorQualifiedLeads).toHaveLength(1);
    expect(result.behaviorQualifiedLeads[0].id).toBe(1);
  });

  it("qualifies leads through repeated sessions", () => {
    const signIns = [
      makeSignIn({
        id: 1,
        leadScore: {
          overallScore: 65,
          tier: "warm",
          signals: { behavior: { strongIntent: false, userMessageCount: 0, sessionCount: 3 } },
        },
      }),
    ];
    const result = buildSellerReportMetrics({ signIns });

    expect(result.behaviorQualifiedLeads).toHaveLength(1);
  });

  it("handles null funnelMetrics gracefully", () => {
    const result = buildSellerReportMetrics({
      signIns: [makeSignIn()],
      funnelMetrics: null,
    });

    expect(result.uniqueVisitors).toBe(0);
    expect(result.uniqueFormStarts).toBe(0);
    expect(result.uniqueVisitorCaptureRate).toBeNull();
  });
});
