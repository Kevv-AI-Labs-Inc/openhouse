"use client";

import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Separator } from "@/components/ui/separator";
import type { SellerReportAccess } from "@/lib/plans";
import { formatPublicModeLabel, inferCaptureMode } from "@/lib/public-mode";
import { isBehaviorQualifiedLead, type SellerReportEvent } from "@/lib/seller-report";
import { buildSellerReportMetrics } from "@/lib/seller-report-metrics";
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock,
  Download,
  Flame,
  Info,
  MapPin,
  Printer,
  Share2,
  TrendingUp,
  Users,
} from "lucide-react";

type Props = {
  event: SellerReportEvent;
  isPublic?: boolean;
  reportAccess?: SellerReportAccess;
  shareUrl?: string;
  csvUrl?: string;
};

function maskEmail(email: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "Hidden";
  const localMasked =
    local.length <= 2 ? `${local.charAt(0)}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}`;
  return `${localMasked}@${domain}`;
}

function maskPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***-***-${digits.slice(-4)}`;
}

function formatDelta(delta: number | null, suffix = "") {
  if (delta === null || delta === 0) {
    return `in line${suffix ? ` ${suffix}` : ""}`;
  }

  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString()}`
    : null;
}

function formatDistanceMiles(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(value < 1 ? 1 : 0)} mi`
    : null;
}

function formatMaybeDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, "MMM d, yyyy");
}

function getComparisonTone(delta: number | null) {
  if (delta === null) {
    return {
      label: "No benchmark yet",
      className: "border-border/60 bg-card/60 text-muted-foreground",
      icon: Info,
    };
  }

  if (delta > 0) {
    return {
      label: "Ahead of benchmark",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
      icon: ArrowUpRight,
    };
  }

  if (delta < 0) {
    return {
      label: "Below benchmark",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      icon: ArrowDownRight,
    };
  }

  return {
    label: "In line with benchmark",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-700",
    icon: TrendingUp,
  };
}

export function SellerReportView({
  event,
  isPublic = false,
  reportAccess = "detailed",
  shareUrl,
  csvUrl,
}: Props) {
  const isDetailedReport = isPublic || reportAccess === "detailed";
  const signIns = event.signIns || [];
  const attributedSignIns = signIns.map((signIn) => ({
    ...signIn,
    inferredCaptureMode: inferCaptureMode({
      captureMode: signIn.captureMode,
      eventPublicMode: event.publicMode,
      signedInAt: signIn.signedInAt,
      eventEndTime: event.endTime,
    }),
  }));
  const {
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
  } = buildSellerReportMetrics({
    signIns: attributedSignIns,
    funnelMetrics: event.funnelMetrics,
  });
  const behaviorQualifiedRate = signIns.length
    ? Math.round((behaviorQualifiedLeads.length / signIns.length) * 100)
    : 0;
  const benchmark = event.benchmark;
  const postEventActivityDays = event.activitySeries.filter(
    (point) => point.signIns > 0 || point.formStarts > 0 || point.pageViews > 0
  ).length;
  const benchmarkLeadTone = getComparisonTone(benchmark?.behaviorQualifiedLeadRate.delta ?? null);
  const benchmarkCaptureTone = getComparisonTone(benchmark?.visitorCaptureRate.delta ?? null);
  const benchmarkCaptureMedian = benchmark?.visitorCaptureRate.median ?? null;
  const benchmarkCaptureDelta = benchmark?.visitorCaptureRate.delta ?? null;
  const benchmarkCompletionMedian = benchmark?.formCompletionRate.median ?? null;
  const benchmarkBehaviorMedian = benchmark?.behaviorQualifiedLeadRate.median ?? null;
  const benchmarkBehaviorDelta = benchmark?.behaviorQualifiedLeadRate.delta ?? null;
  const benchmarkInquiryMedian = benchmark?.inquiryShare.median ?? null;
  const financialFacts = event.propertyFacts?.financial;
  const neighborhoodFacts = event.propertyFacts?.neighborhood;
  const listingFacts = event.propertyFacts?.listing;
  const marketFacts = event.propertyFacts?.market;
  const comparableSales = (marketFacts?.comparableSales ?? []).slice(0, 3);
  const keyMarketFacts = [
    listingFacts?.status ? `Listing status: ${listingFacts.status}` : null,
    typeof listingFacts?.daysOnMarket === "number"
      ? `Days on market: ${listingFacts.daysOnMarket}`
      : null,
    formatCurrency(financialFacts?.annualTaxes)
      ? `Annual taxes: ${formatCurrency(financialFacts?.annualTaxes)}`
      : null,
    formatCurrency(financialFacts?.hoaFee)
      ? `HOA: ${formatCurrency(financialFacts?.hoaFee)}/mo`
      : null,
    formatCurrency(financialFacts?.commonCharges)
      ? `Common charges: ${formatCurrency(financialFacts?.commonCharges)}/mo`
      : null,
    formatCurrency(financialFacts?.estimatedMonthlyCarry)
      ? `Estimated carry: ${formatCurrency(financialFacts?.estimatedMonthlyCarry)}`
      : null,
  ].filter((item): item is string => Boolean(item));
  const neighborhoodHighlights = [
    ...(neighborhoodFacts?.nearbyTransit ?? []),
    ...(neighborhoodFacts?.nearbyHighlights ?? []),
  ].slice(0, 4);
  const hasMarketSnapshot =
    keyMarketFacts.length > 0 ||
    comparableSales.length > 0 ||
    Boolean(marketFacts?.narrative) ||
    Boolean(marketFacts?.medianSoldPrice) ||
    Boolean(marketFacts?.medianPricePerSqft) ||
    Boolean(neighborhoodFacts?.name) ||
    neighborhoodHighlights.length > 0;

  const renderDistributionBlock = (
    title: string,
    items: Array<{ key: string; label: string; count: number; percentage: number }>,
    emptyLabel: string
  ) => (
    <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      {items.length > 0 ? (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div key={`${title}-${item.key}`} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{item.label}</span>
                <span className="font-medium text-muted-foreground">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/35">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  style={{ width: `${Math.max(item.count > 0 ? 10 : 0, item.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );

  const internalExecutiveSummary = [
    uniqueVisitors === 0
      ? "Traffic tracking is live, but this listing has not recorded enough public activity yet to benchmark conversion performance."
      : benchmarkCaptureMedian !== null && uniqueVisitorCaptureRate !== null
        ? `${uniqueVisitors} unique listing visitors produced ${signIns.length} sign-ins, a ${uniqueVisitorCaptureRate}% capture rate that sits ${formatDelta(benchmarkCaptureDelta, "pts")} versus the recent portfolio median of ${benchmarkCaptureMedian}%.`
        : `${uniqueVisitors} unique listing visitors produced ${signIns.length} sign-ins, giving the seller a concrete baseline for how efficiently this page converts attention into contacts.`,
    uniqueFormStarts > 0
      ? benchmarkCompletionMedian !== null && uniqueFormCompletionRate !== null
        ? `${uniqueFormStarts} visitors started the form and ${signIns.length} finished it, a ${uniqueFormCompletionRate}% completion rate versus a comparable-listing median of ${benchmarkCompletionMedian}%.`
        : `${uniqueFormStarts} visitors started the form and ${signIns.length} completed it, showing how much of the demand is making it all the way through capture.`
      : "Form-start tracking will populate as soon as visitors begin engaging with the public sign-in flow.",
    benchmarkBehaviorMedian !== null
      ? `${behaviorQualifiedLeads.length} leads showed behavior-based buying intent, which is ${formatDelta(benchmarkBehaviorDelta, "pts")} versus the portfolio median for comparable listings.`
      : behaviorQualifiedLeads.length > 0
        ? `${behaviorQualifiedLeads.length} leads showed behavior-based buying intent through repeat visits, deeper Q&A, or clear next-step questions.`
        : "Lead quality is still mostly contact capture today, so the next objective is to uncover stronger intent signals through follow-up and Q&A.",
  ];
  const publicExecutiveSummary = [
    uniqueVisitors === 0
      ? "Public traffic tracking is active, but this listing has not accumulated enough visitor activity yet to show a full conversion story."
      : `${uniqueVisitors} unique visitors viewed the listing page and ${signIns.length} left their details${uniqueVisitorCaptureRate !== null ? `, producing a ${uniqueVisitorCaptureRate}% visitor-to-sign-in rate.` : "."}`,
    uniqueFormStarts > 0
      ? `${uniqueFormStarts} visitors started the sign-in form and ${signIns.length} completed it${uniqueFormCompletionRate !== null ? `, a ${uniqueFormCompletionRate}% completion rate.` : "."}`
      : "Form-start tracking will populate as more visitors engage with the sign-in flow.",
    behaviorQualifiedLeads.length > 0
      ? `${behaviorQualifiedLeads.length} visitors showed stronger buying intent through repeat engagement, deeper Q&A, or clear next-step questions.`
      : "Visitor interest is still mostly early-stage, so the follow-up plan should focus on uncovering timing, financing, and showing intent.",
  ];
  const executiveSummary = isPublic ? publicExecutiveSummary : internalExecutiveSummary;
  const internalTalkingPoints = [
    {
      title: "Traffic to capture",
      body:
        uniqueVisitors > 0 && benchmarkCaptureMedian !== null && uniqueVisitorCaptureRate !== null && benchmark
          ? `This listing converted ${uniqueVisitorCaptureRate}% of public visitors into sign-ins, compared with a ${benchmarkCaptureMedian}% median across ${benchmark.cohortLabel}.`
          : uniqueVisitors > 0
            ? `${uniqueVisitors} unique listing visitors turned into ${signIns.length} captured contacts, giving the seller a measurable view of how well the property page converts attention into leads.`
            : "Traffic has not accumulated yet, so the conversion story is still waiting on visitor volume.",
    },
    {
      title: "Lead quality",
      body:
        benchmarkBehaviorMedian !== null
          ? `${behaviorQualifiedLeads.length} visitors qualified on behavior, a ${behaviorQualifiedRate}% quality rate compared with a ${benchmarkBehaviorMedian}% comparable-listing median.`
          : behaviorQualifiedLeads.length > 0
            ? `${behaviorQualifiedLeads.length} leads did more than sign in. They asked substantive questions, came back, or showed clear next-step intent, making them the strongest follow-up pool.`
            : "Most visitors have only completed a basic sign-in so far. The next objective is to convert contact capture into richer buyer signals.",
    },
    {
      title: "Post-event demand",
      body:
        benchmarkInquiryMedian !== null
          ? `${inquiryShare}% of captured demand came after the event through the reusable link, versus a ${benchmarkInquiryMedian}% median on comparable listings.`
          : listingInquiryCaptures > 0
            ? `${inquiryShare}% of captured demand came through the reusable listing link after the live event, proving the property kept generating inbound interest beyond the open house window.`
            : `${onSiteShare}% of captured demand came on-site, so the live open house is still the primary source of lead generation for this listing.`,
    },
  ];
  const publicTalkingPoints = [
    {
      title: "Traffic to capture",
      body:
        uniqueVisitors > 0
          ? `${uniqueVisitors} people visited the listing page and ${signIns.length} chose to share their information, giving a concrete picture of how much buyer attention the home generated.`
          : "Traffic is still building, so the conversion story will become clearer as more visitors reach the listing page.",
    },
    {
      title: "Lead quality",
      body:
        behaviorQualifiedLeads.length > 0
          ? `${behaviorQualifiedLeads.length} visitors showed stronger intent through repeated engagement or more specific questions, which helps separate casual lookers from serious buyers.`
          : "Most responses are still early-stage interest, so the next step is careful follow-up to understand timing, financing, and motivation.",
    },
    {
      title: "Post-event demand",
      body:
        listingInquiryCaptures > 0
          ? `${inquiryShare}% of captured demand arrived after the live event through the reusable listing link, showing that interest continued after the open house window.`
          : `${onSiteShare}% of captured demand came during the live event, so the open house itself remained the main demand driver for this listing.`,
    },
  ];
  const sellerTalkingPoints = isPublic ? publicTalkingPoints : internalTalkingPoints;

  const hourMap: Record<string, number> = {};
  attributedSignIns
    .filter((signIn) => signIn.inferredCaptureMode === "open_house")
    .forEach((s) => {
      if (s.signedInAt) {
        const hour = format(new Date(s.signedInAt), "h:mm a");
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      }
    });

  const copyShareLink = async () => {
    const target = shareUrl || window.location.href;
    await navigator.clipboard.writeText(target);
    toast.success(isPublic ? "Shared report link copied" : "Seller report share link copied");
  };

  const showBack = !isPublic;
  const reportTitle = isDetailedReport ? "Seller Report" : "Listing Recap";

  return (
    <div className="space-y-6">
      <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBack ? (
            <Link href="/dashboard/events">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{reportTitle}</h1>
              {isPublic ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                  Shared View
                </Badge>
              ) : isDetailedReport ? (
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                  Seller-ready
                </Badge>
              ) : (
                <Badge className="border-border/70 bg-card/60 text-muted-foreground">
                  Internal recap
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{event.propertyAddress}</p>
            {isPublic ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Visitor phone numbers and email addresses are hidden in the shared version.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {isDetailedReport
                  ? "Shareable seller view keeps contact details hidden by default."
                  : "Free accounts keep this page as an internal recap until Pro or a trial launch unlocks seller sharing."}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {!isPublic && isDetailedReport && shareUrl ? (
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Share2 className="mr-2 h-4 w-4" />
              Copy Shared Link
            </Button>
          ) : isPublic ? (
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Share2 className="mr-2 h-4 w-4" />
              Copy Link
            </Button>
          ) : null}
          {!isPublic && csvUrl ? (
            <Button variant="outline" size="sm" onClick={() => window.open(csvUrl, "_blank", "noopener,noreferrer")}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <MapPin className="h-5 w-5 text-emerald-400" />
                {event.propertyAddress}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {event.mlsNumber && <span>MLS# {event.mlsNumber}</span>}
                {event.listPrice && <span>${Number(event.listPrice).toLocaleString()}</span>}
                {event.bedrooms && <span>{event.bedrooms} bed</span>}
                {event.bathrooms && <span>{event.bathrooms} bath</span>}
                {event.sqft && <span>{event.sqft.toLocaleString()} sqft</span>}
                <span>{formatPublicModeLabel(event.publicMode)} link enabled</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics strip — asymmetric: two larger primary KPIs left, 3 secondary right */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-border/55 bg-card/60">
            <CardContent className="p-5 text-center">
              <Users className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
              <div className="font-mono text-3xl font-semibold">{uniqueVisitors}</div>
              <div className="mt-1 text-xs text-muted-foreground">Unique Listing Visitors</div>
            </CardContent>
          </Card>
          <Card className="border-border/55 bg-card/60">
            <CardContent className="p-5 text-center">
              <Clock className="mx-auto mb-2 h-6 w-6 text-purple-400" />
              <div className="font-mono text-3xl font-semibold">{signIns.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">Sign-Ins</div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/55 bg-card/60">
            <CardContent className="p-4 text-center">
              <TrendingUp className="mx-auto mb-1.5 h-5 w-5 text-blue-400" />
              <div className="font-mono text-2xl font-semibold">{uniqueFormStarts}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Form Starts</div>
            </CardContent>
          </Card>
          <Card className="border-border/55 bg-card/60">
            <CardContent className="p-4 text-center">
              <Flame className="mx-auto mb-1.5 h-5 w-5 text-orange-400" />
              <div className="font-mono text-2xl font-semibold">{behaviorQualifiedLeads.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Behavior-Qualified</div>
            </CardContent>
          </Card>
          <Card className="border-border/55 bg-card/60">
            <CardContent className="p-4 text-center">
              <Share2 className="mx-auto mb-1.5 h-5 w-5 text-teal-500" />
              <div className="font-mono text-2xl font-semibold">{listingInquiryCaptures}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Long-Term Leads</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!isDetailedReport ? (
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardHeader>
            <CardTitle className="text-base">Basic Recap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Free accounts keep seller reporting in the dashboard as an internal recap. Shared
              links, AI narrative, and post-event demand storytelling unlock on Pro and on eligible
              trial launches.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/settings">
                <Button size="sm">Unlock Seller Report</Button>
              </Link>
              <p className="text-xs text-muted-foreground">
                Your first 3 published launches still unlock the full seller-facing version.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isDetailedReport ? (
      <Card className="border-border/60 bg-gradient-to-br from-background via-card/70 to-muted/20">
        <CardHeader><CardTitle className="text-base">Executive Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {executiveSummary.map((line) => (
              <div key={line} className="rounded-2xl border border-border/50 bg-background/75 p-4 text-sm leading-relaxed text-muted-foreground">{line}</div>
            ))}
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-border/50 bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Average AI score</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{averageLeadScore}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {scoredLeadCount > 0 ? `Based on ${scoredLeadCount} captured visitors with AI lead scoring attached.` : "No AI-scored leads yet for this listing."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ongoing demand</p>
              <p className="mt-2 font-mono text-3xl font-semibold">{inquiryShare}%</p>
              <p className="mt-2 text-xs text-muted-foreground">Share of captured demand generated by the reusable link after the live event.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {!isPublic && isDetailedReport && benchmark ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portfolio Benchmark</CardTitle>
            <p className="text-sm text-muted-foreground">
              Compared against {benchmark.cohortLabel}. Confidence is{" "}
              <span className="font-medium text-foreground">{benchmark.confidence}</span>.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[
              {
                label: "Sign-ins",
                metric: benchmark.signIns,
                suffix: "",
              },
              {
                label: "Capture rate",
                metric: benchmark.visitorCaptureRate,
                suffix: "%",
              },
              {
                label: "Form completion",
                metric: benchmark.formCompletionRate,
                suffix: "%",
              },
              {
                label: "Behavior-qualified",
                metric: benchmark.behaviorQualifiedLeadRate,
                suffix: "%",
              },
              {
                label: "Post-event share",
                metric: benchmark.inquiryShare,
                suffix: "%",
              },
            ].map((item) => {
              const tone = getComparisonTone(item.metric.delta);
              const ToneIcon = tone.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/55 bg-background/75 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {item.label}
                  </p>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      {item.metric.current !== null ? `${item.metric.current}${item.suffix}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      median {item.metric.median !== null ? `${item.metric.median}${item.suffix}` : "—"}
                    </p>
                  </div>
                  <div className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${tone.className}`}>
                    <ToneIcon className="h-3 w-3" />
                    {item.metric.delta !== null ? formatDelta(item.metric.delta, item.suffix) : tone.label}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Key Insights</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Visitor-to-sign-in rate</span><span className="font-medium">{uniqueVisitorCaptureRate !== null ? `${uniqueVisitorCaptureRate}%` : "Waiting for traffic"}</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Form completion rate</span><span className="font-medium">{uniqueFormCompletionRate !== null ? `${uniqueFormCompletionRate}%` : "Waiting for form starts"}</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Behavior-qualified leads</span><span className="font-medium">{behaviorQualifiedLeads.length} ({signIns.length ? Math.round((behaviorQualifiedLeads.length / signIns.length) * 100) : 0}%)</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Visitors with an agent</span><span className="font-medium">{withAgent} ({signIns.length ? Math.round((withAgent / signIns.length) * 100) : 0}%)</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Pre-approved buyers</span><span className="font-medium">{preApproved} ({signIns.length ? Math.round((preApproved / signIns.length) * 100) : 0}%)</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Warm leads</span><span className="font-medium">{warmLeads.length} ({signIns.length ? Math.round((warmLeads.length / signIns.length) * 100) : 0}%)</span></div>
          <Separator />
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Direct buyer opportunities</span><span className="font-medium">{noAgent} ({directBuyerPercent}%)</span></div>
        </CardContent>
      </Card>

      {isDetailedReport ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Visitor Intent Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">
              Show the seller how intent breaks down across urgency, seriousness, and AI lead quality.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {renderDistributionBlock(
              "Interest level",
              interestLevelDistribution,
              "No visitor intent responses yet."
            )}
            {renderDistributionBlock(
              "Buying timeline",
              buyingTimelineDistribution,
              "No timeline responses yet."
            )}
            {renderDistributionBlock(
              "Lead tier",
              leadTierDistribution,
              "AI lead tiers will populate after scoring runs."
            )}
          </CardContent>
        </Card>
      ) : null}

      {isDetailedReport ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buyer Readiness</CardTitle>
            <p className="text-sm text-muted-foreground">
              Separate visitors who are ready to move now from the longer nurture pipeline.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ready now
                </p>
                <p className="mt-3 font-mono text-3xl font-semibold">{readyNowCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Buyers showing near-term timing or strong financing readiness.
                </p>
              </div>
              <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Longer nurture
                </p>
                <p className="mt-3 font-mono text-3xl font-semibold">{nurtureLaterCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Visitors who need longer-term follow-up before a decision window opens.
                </p>
              </div>
              <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Missing signals
                </p>
                <p className="mt-3 font-mono text-3xl font-semibold">{missingIntentSignalsCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Contacts captured without budget, timeline, or explicit interest details.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Budget signals
              </p>
              {priceRangeResponses.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {priceRangeResponses.map((item) => (
                    <div key={item.key} className="rounded-xl border border-border/50 bg-background/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <Badge variant="outline" className="text-xs">
                          {item.count} lead{item.count === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Mentioned by {item.percentage}% of captured visitors.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Budget ranges will appear here once visitors start filling in the optional price field.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isDetailedReport && hasMarketSnapshot ? (
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Market Context Snapshot</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use imported listing facts and optional comparable-sales data to anchor the seller conversation.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {keyMarketFacts.length > 0 ? (
                <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Listing signals
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {keyMarketFacts.map((fact) => (
                      <p key={fact}>{fact}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {neighborhoodFacts?.name || neighborhoodHighlights.length > 0 ? (
                <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Neighborhood context
                  </p>
                  {neighborhoodFacts?.name ? (
                    <p className="mt-3 text-sm font-medium text-foreground">{neighborhoodFacts.name}</p>
                  ) : null}
                  {neighborhoodHighlights.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {neighborhoodHighlights.map((item) => (
                        <Badge key={item} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {marketFacts?.narrative ? (
                <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Market note
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {marketFacts.narrative}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              {marketFacts?.medianSoldPrice || marketFacts?.medianPricePerSqft || marketFacts?.saleWindowDays ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Median sold price
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {formatCurrency(marketFacts?.medianSoldPrice) || "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Median $ / sqft
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {formatCurrency(marketFacts?.medianPricePerSqft) || "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Sale window
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {typeof marketFacts?.saleWindowDays === "number"
                        ? `${marketFacts.saleWindowDays} days`
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : null}

              {comparableSales.length > 0 ? (
                <div className="rounded-2xl border border-border/55 bg-background/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Comparable sales
                    </p>
                    {marketFacts?.source ? (
                      <Badge variant="outline" className="text-[10px]">
                        {marketFacts.source}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3">
                    {comparableSales.map((sale, index) => (
                      <div
                        key={`${sale.address || "sale"}-${index}`}
                        className="rounded-xl border border-border/50 bg-background/80 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {sale.address || `Comparable ${index + 1}`}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[
                                formatMaybeDate(sale.soldAt),
                                formatDistanceMiles(sale.distanceMiles),
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Recent sale"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrency(sale.soldPrice) || "—"}
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {[
                            typeof sale.beds === "number" ? `${sale.beds} bd` : null,
                            sale.baths ? `${sale.baths} ba` : null,
                            typeof sale.sqft === "number" ? `${sale.sqft.toLocaleString()} sqft` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {sale.notes ? (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {sale.notes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isDetailedReport ? (
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Demand Curve</CardTitle>
          <p className="text-sm text-muted-foreground">
            Daily public-page interest, form starts, and completed captures around the event window.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Demand curve KPI badges — asymmetric, no 3-col equal */}
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.8fr]">
            <div
              className={`rounded-2xl border px-4 py-3 ${
                isPublic
                  ? "border-border/55 bg-background/75"
                  : benchmarkCaptureTone.className
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Capture efficiency</p>
              <p className="mt-2 font-mono text-2xl font-semibold">{uniqueVisitorCaptureRate !== null ? `${uniqueVisitorCaptureRate}%` : "—"}</p>
              <p className="mt-1 text-xs">
                {isPublic ? "Share of page visitors who completed sign-in." : benchmarkCaptureTone.label}
              </p>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 ${
                isPublic
                  ? "border-border/55 bg-background/75"
                  : benchmarkLeadTone.className
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Lead quality</p>
              <p className="mt-2 font-mono text-2xl font-semibold">{behaviorQualifiedRate}%</p>
              <p className="mt-1 text-xs">
                {isPublic ? "Share of captured visitors showing stronger buying intent." : benchmarkLeadTone.label}
              </p>
            </div>
            <div className="rounded-2xl border border-border/55 bg-background/75 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Active demand days</p>
              <p className="mt-2 font-mono text-2xl font-semibold">{postEventActivityDays}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Days with tracked visits, form starts, or captures on this listing link.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {event.activitySeries.map((point) => {
              const maxValue = Math.max(
                1,
                ...event.activitySeries.flatMap((item) => [
                  item.pageViews,
                  item.formStarts,
                  item.signIns,
                ])
              );

              return (
                <div
                  key={point.label}
                  className="grid grid-cols-[4.5rem_1fr] items-center gap-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{point.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {point.pageViews + point.formStarts + point.signIns} touches
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "Views", value: point.pageViews, className: "bg-emerald-500" },
                      { label: "Starts", value: point.formStarts, className: "bg-sky-500" },
                      { label: "Sign-ins", value: point.signIns, className: "bg-orange-500" },
                    ].map((series) => (
                      <div key={series.label} className="flex items-center gap-3">
                        <span className="w-12 text-[11px] text-muted-foreground">{series.label}</span>
                        <div className="h-2.5 flex-1 rounded-full bg-muted/35">
                          <div
                            className={`h-full rounded-full ${series.className}`}
                            style={{
                              width: `${Math.max(
                                series.value > 0 ? 10 : 0,
                                (series.value / maxValue) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-7 text-right text-[11px] font-medium text-foreground">
                          {series.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {isDetailedReport ? (
      <Card>
        <CardHeader><CardTitle className="text-base">Seller Talking Points</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sellerTalkingPoints.map((item) => (
            <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : null}

      {isDetailedReport ? (
      <Card>
        <CardHeader><CardTitle className="text-base">Lead Attribution</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Separate live open house traffic from leads captured later through the reusable public link so the seller can see whether interest kept building after the doors closed.</p>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">On-site open house captures</span><span className="font-medium">{openHouseCaptures} ({onSiteShare}%)</span></div>
              <div className="h-2 rounded-full bg-muted/40"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${signIns.length ? (openHouseCaptures / signIns.length) * 100 : 0}%` }} /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Reusable-link listing inquiries</span><span className="font-medium">{listingInquiryCaptures} ({inquiryShare}%)</span></div>
              <div className="h-2 rounded-full bg-muted/40"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500" style={{ width: `${signIns.length ? (listingInquiryCaptures / signIns.length) * 100 : 0}%` }} /></div>
            </div>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {Object.keys(hourMap).length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Live Open House Traffic Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(hourMap).map(([hour, count]) => (
                <div key={hour} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-muted-foreground">{hour}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted/30">
                    <div className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 pr-2" style={{ width: `${Math.max(20, (count / Math.max(...Object.values(hourMap))) * 100)}%` }}>
                      <span className="text-xs font-medium text-white">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Visitors ({signIns.length})</CardTitle>
          {isPublic ? (
            <p className="text-sm text-muted-foreground">Shared view keeps visitor phone numbers and email addresses hidden.</p>
          ) : null}
        </CardHeader>
        <CardContent>
          {signIns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No visitors have signed in yet</p>
          ) : (
            <div className="space-y-3">
              {attributedSignIns.map((s, i) => {
                const contactLine = isPublic
                  ? [maskPhone(s.phone), maskEmail(s.email)].filter(Boolean).join(" · ") || "Contact details hidden"
                  : [s.phone, s.email].filter(Boolean).join(" · ") || "No contact info";
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-medium text-emerald-400">{i + 1}</div>
                      <div>
                        <p className="text-sm font-medium">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{contactLine}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isBehaviorQualifiedLead(s) ? <Badge className="border-orange-500/30 bg-orange-500/10 text-xs text-orange-400">Behavior Qualified</Badge> : null}
                      {s.interestLevel === "somewhat" ? <Badge className="border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400">WARM</Badge> : null}
                      {s.isPreApproved === "yes" ? <Badge className="border-blue-500/30 bg-blue-500/10 text-xs text-blue-400">Pre-Approved</Badge> : null}
                      {!s.hasAgent ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400">No Agent</Badge> : null}
                      <Badge variant="secondary" className="text-xs">{formatPublicModeLabel(s.inferredCaptureMode)}</Badge>
                      <span className="text-xs text-muted-foreground">{s.signedInAt ? format(new Date(s.signedInAt), "h:mm a") : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      {isPublic ? <PublicTrustFooter /> : null}
    </div>
  );
}
