import type { EventPropertyFacts } from "@/lib/listing-import-shared";
import type { SellerReportAccess } from "@/lib/plans";

export interface SellerReportLeadScore {
  overallScore: number;
  tier: string;
  signals?: Record<string, unknown>;
}

export interface SellerReportSignIn {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  captureMode: string | null;
  hasAgent: boolean;
  isPreApproved: string | null;
  interestLevel: string | null;
  buyingTimeline: string | null;
  priceRange: string | null;
  leadTier: string | null;
  leadScore: SellerReportLeadScore | null;
  signedInAt: string;
}

export interface SellerReportFunnelMetrics {
  uniqueVisitors: number;
  uniqueFormStarts: number;
}

export interface SellerReportActivityPoint {
  label: string;
  pageViews: number;
  formStarts: number;
  signIns: number;
}

export interface SellerReportBenchmarkMetric {
  current: number | null;
  median: number | null;
  delta: number | null;
}

export interface SellerReportBenchmark {
  comparableEventsCount: number;
  cohortLabel: string;
  confidence: "thin" | "directional" | "solid";
  signIns: SellerReportBenchmarkMetric;
  visitorCaptureRate: SellerReportBenchmarkMetric;
  formCompletionRate: SellerReportBenchmarkMetric;
  behaviorQualifiedLeadRate: SellerReportBenchmarkMetric;
  inquiryShare: SellerReportBenchmarkMetric;
}

export interface SellerReportDistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface SellerReportEvent {
  id: number;
  uuid: string;
  propertyAddress: string;
  mlsNumber: string | null;
  listPrice: string | null;
  propertyType: string | null;
  startTime: string;
  endTime: string;
  publicMode: string;
  status: string;
  totalSignIns: number;
  hotLeadsCount: number;
  bedrooms: number | null;
  bathrooms: string | null;
  sqft: number | null;
  signIns: SellerReportSignIn[];
  funnelMetrics: SellerReportFunnelMetrics;
  activitySeries: SellerReportActivityPoint[];
  benchmark: SellerReportBenchmark | null;
  propertyFacts?: EventPropertyFacts | null;
  reportAccess?: SellerReportAccess;
}

export function isBehaviorQualifiedLead(signIn: SellerReportSignIn) {
  const behavior =
    signIn.leadScore?.signals &&
    typeof signIn.leadScore.signals === "object" &&
    signIn.leadScore.signals !== null &&
    "behavior" in signIn.leadScore.signals &&
    typeof signIn.leadScore.signals.behavior === "object" &&
    signIn.leadScore.signals.behavior !== null
      ? (signIn.leadScore.signals.behavior as Record<string, unknown>)
      : null;

  if (!behavior) return false;

  const userMessageCount = Number(behavior.userMessageCount ?? 0);
  const sessionCount = Number(behavior.sessionCount ?? 0);
  const strongIntent = Boolean(behavior.strongIntent);
  const actionIntents = Array.isArray(behavior.actionIntents)
    ? behavior.actionIntents.filter((value): value is string => typeof value === "string")
    : [];

  return strongIntent || actionIntents.length > 0 || userMessageCount >= 2 || sessionCount >= 2;
}
