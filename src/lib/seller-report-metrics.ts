import { isBehaviorQualifiedLead, type SellerReportSignIn } from "@/lib/seller-report";

export function buildSellerReportMetrics(params: {
  signIns: Array<
    SellerReportSignIn & {
      inferredCaptureMode?: "open_house" | "listing_inquiry";
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

  return {
    uniqueVisitors,
    uniqueFormStarts,
    behaviorQualifiedLeads,
    warmLeads,
    withAgent,
    preApproved,
    noAgent,
    openHouseCaptures,
    listingInquiryCaptures,
    scoredLeadCount,
    averageLeadScore,
    uniqueVisitorCaptureRate,
    uniqueFormCompletionRate,
    directBuyerPercent,
    inquiryShare,
    onSiteShare,
  };
}
