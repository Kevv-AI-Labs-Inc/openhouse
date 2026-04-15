import {
  isBehaviorQualifiedLead,
  type SellerReportDistributionItem,
  type SellerReportSignIn,
} from "@/lib/seller-report";

type SellerReportCaptureMode = "open_house" | "listing_inquiry";

function toDistributionItems(
  definitions: Array<{ key: string; label: string }>,
  counts: Map<string, number>,
  total: number
): SellerReportDistributionItem[] {
  return definitions
    .map((definition) => {
      const count = counts.get(definition.key) ?? 0;
      return {
        key: definition.key,
        label: definition.label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    })
    .filter((item) => item.count > 0 || total === 0);
}

function normalizePriceRange(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

export function buildSellerReportMetrics(params: {
  signIns: Array<
    SellerReportSignIn & {
      inferredCaptureMode?: SellerReportCaptureMode;
    }
  >;
  funnelMetrics?: {
    uniqueVisitors?: number | null;
    uniqueFormStarts?: number | null;
  } | null;
}) {
  const signIns = params.signIns;
  const uniqueVisitors = params.funnelMetrics?.uniqueVisitors ?? 0;
  const uniqueFormStarts = params.funnelMetrics?.uniqueFormStarts ?? 0;
  const behaviorQualifiedLeads = signIns.filter(isBehaviorQualifiedLead);
  const warmLeads = signIns.filter((signIn) => signIn.leadTier === "warm");
  const withAgent = signIns.filter((signIn) => signIn.hasAgent).length;
  const preApproved = signIns.filter((signIn) => signIn.isPreApproved === "yes").length;
  const noAgent = signIns.filter((signIn) => !signIn.hasAgent).length;
  const readyNowCount = signIns.filter(
    (signIn) =>
      signIn.buyingTimeline === "0_3_months" ||
      (signIn.isPreApproved === "yes" &&
        (signIn.interestLevel === "very" || signIn.leadTier === "hot"))
  ).length;
  const nurtureLaterCount = signIns.filter(
    (signIn) =>
      signIn.buyingTimeline === "6_12_months" ||
      signIn.buyingTimeline === "over_12_months" ||
      signIn.buyingTimeline === "just_browsing" ||
      signIn.interestLevel === "just_looking"
  ).length;
  const missingIntentSignalsCount = signIns.filter(
    (signIn) =>
      !signIn.interestLevel &&
      !signIn.buyingTimeline &&
      !normalizePriceRange(signIn.priceRange)
  ).length;
  const openHouseCaptures = signIns.filter(
    (signIn) => signIn.inferredCaptureMode === "open_house"
  ).length;
  const listingInquiryCaptures = signIns.filter(
    (signIn) => signIn.inferredCaptureMode === "listing_inquiry"
  ).length;
  const scoredLeadCount = signIns.filter(
    (signIn) => signIn.leadScore?.overallScore !== undefined
  ).length;
  const averageLeadScore = scoredLeadCount
    ? Math.round(
        signIns.reduce(
          (sum, signIn) => sum + (signIn.leadScore?.overallScore ?? 0),
          0
        ) / scoredLeadCount
      )
    : 0;
  const uniqueVisitorCaptureRate =
    uniqueVisitors > 0 ? Math.round((signIns.length / uniqueVisitors) * 100) : null;
  const uniqueFormCompletionRate =
    uniqueFormStarts > 0 ? Math.round((signIns.length / uniqueFormStarts) * 100) : null;
  const directBuyerPercent = signIns.length
    ? Math.round((noAgent / signIns.length) * 100)
    : 0;
  const inquiryShare = signIns.length
    ? Math.round((listingInquiryCaptures / signIns.length) * 100)
    : 0;
  const onSiteShare = signIns.length
    ? Math.round((openHouseCaptures / signIns.length) * 100)
    : 0;
  const interestLevelCounts = new Map(
    signIns.reduce<Array<[string, number]>>((items, signIn) => {
      const key = signIn.interestLevel || "unknown";
      const existing = items.find((item) => item[0] === key);
      if (existing) {
        existing[1] += 1;
      } else {
        items.push([key, 1]);
      }
      return items;
    }, [])
  );
  const buyingTimelineCounts = new Map(
    signIns.reduce<Array<[string, number]>>((items, signIn) => {
      const key = signIn.buyingTimeline || "unknown";
      const existing = items.find((item) => item[0] === key);
      if (existing) {
        existing[1] += 1;
      } else {
        items.push([key, 1]);
      }
      return items;
    }, [])
  );
  const leadTierCounts = new Map(
    signIns.reduce<Array<[string, number]>>((items, signIn) => {
      const key = signIn.leadTier || "unscored";
      const existing = items.find((item) => item[0] === key);
      if (existing) {
        existing[1] += 1;
      } else {
        items.push([key, 1]);
      }
      return items;
    }, [])
  );
  const priceRangeCounts = new Map<string, number>();

  for (const signIn of signIns) {
    const normalized = normalizePriceRange(signIn.priceRange);
    if (!normalized) {
      continue;
    }

    priceRangeCounts.set(normalized, (priceRangeCounts.get(normalized) ?? 0) + 1);
  }

  const interestLevelDistribution = toDistributionItems(
    [
      { key: "very", label: "Very interested" },
      { key: "somewhat", label: "Somewhat interested" },
      { key: "just_looking", label: "Just looking" },
      { key: "unknown", label: "No answer" },
    ],
    interestLevelCounts,
    signIns.length
  );
  const buyingTimelineDistribution = toDistributionItems(
    [
      { key: "0_3_months", label: "0-3 months" },
      { key: "3_6_months", label: "3-6 months" },
      { key: "6_12_months", label: "6-12 months" },
      { key: "over_12_months", label: "12+ months" },
      { key: "just_browsing", label: "Just browsing" },
      { key: "unknown", label: "No answer" },
    ],
    buyingTimelineCounts,
    signIns.length
  );
  const leadTierDistribution = toDistributionItems(
    [
      { key: "hot", label: "Hot" },
      { key: "warm", label: "Warm" },
      { key: "cold", label: "Cold" },
      { key: "unscored", label: "Unscored" },
    ],
    leadTierCounts,
    signIns.length
  );
  const priceRangeResponses = Array.from(priceRangeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([label, count]) => ({
      key: label,
      label,
      count,
      percentage: signIns.length > 0 ? Math.round((count / signIns.length) * 100) : 0,
    }));

  return {
    uniqueVisitors,
    uniqueFormStarts,
    behaviorQualifiedLeads,
    warmLeads,
    withAgent,
    preApproved,
    noAgent,
    readyNowCount,
    nurtureLaterCount,
    missingIntentSignalsCount,
    openHouseCaptures,
    listingInquiryCaptures,
    scoredLeadCount,
    averageLeadScore,
    uniqueVisitorCaptureRate,
    uniqueFormCompletionRate,
    directBuyerPercent,
    inquiryShare,
    onSiteShare,
    interestLevelDistribution,
    buyingTimelineDistribution,
    leadTierDistribution,
    priceRangeResponses,
  };
}
