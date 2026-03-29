import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, publicFunnelEvents, signIns } from "@/lib/db/schema";
import type {
  SellerReportBenchmark,
  SellerReportEvent,
  SellerReportSignIn,
} from "@/lib/seller-report";
import { inferCaptureMode } from "@/lib/public-mode";
import { buildSellerReportMetrics } from "@/lib/seller-report-metrics";

function mapSellerReportSignIn(signIn: typeof signIns.$inferSelect): SellerReportSignIn {
  const leadScore =
    signIn.leadScore && typeof signIn.leadScore === "object"
      ? {
          overallScore: Number(
            (signIn.leadScore as { overallScore?: number | string }).overallScore ?? 0
          ),
          tier: String((signIn.leadScore as { tier?: string }).tier ?? ""),
          signals:
            typeof (signIn.leadScore as { signals?: Record<string, unknown> }).signals === "object"
              ? ((signIn.leadScore as { signals?: Record<string, unknown> }).signals ?? undefined)
              : undefined,
        }
      : null;

  return {
    id: signIn.id,
    fullName: signIn.fullName,
    phone: signIn.phone,
    email: signIn.email,
    captureMode: signIn.captureMode,
    hasAgent: Boolean(signIn.hasAgent),
    isPreApproved: signIn.isPreApproved,
    interestLevel: signIn.interestLevel,
    buyingTimeline: signIn.buyingTimeline,
    priceRange: signIn.priceRange,
    leadTier: signIn.leadTier,
    leadScore,
    signedInAt: signIn.signedInAt.toISOString(),
  };
}

function parseListPrice(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function roundMetric(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value);
}

function buildBenchmarkMetric(current: number | null, medianValue: number | null) {
  if (current === null || medianValue === null) {
    return {
      current,
      median: medianValue,
      delta: null,
    };
  }

  return {
    current,
    median: medianValue,
    delta: roundMetric(current - medianValue),
  };
}

function getBenchmarkConfidence(comparableEventsCount: number): SellerReportBenchmark["confidence"] {
  if (comparableEventsCount >= 8) {
    return "solid";
  }

  if (comparableEventsCount >= 4) {
    return "directional";
  }

  return "thin";
}

function buildCohortLabel(params: {
  comparableEventsCount: number;
  propertyType: string | null;
  publicMode: string;
  priceBandApplied: boolean;
}) {
  const modeLabel = params.publicMode === "listing_inquiry" ? "listing inquiry" : "open house";
  const propertyTypeLabel = params.propertyType
    ? params.propertyType.replace(/_/g, " ")
    : "listing";
  const cohort = `${params.comparableEventsCount} recent ${propertyTypeLabel} ${modeLabel}`;

  return params.priceBandApplied ? `${cohort} in a similar price band` : cohort;
}

function mapAttributionMetrics(params: {
  eventPublicMode: string;
  eventEndTime: Date;
  signIns: SellerReportSignIn[];
  funnelMetrics: { uniqueVisitors: number; uniqueFormStarts: number };
}) {
  const signIns = params.signIns.map((signIn) => ({
    ...signIn,
    inferredCaptureMode: inferCaptureMode({
      captureMode: signIn.captureMode,
      eventPublicMode: params.eventPublicMode,
      signedInAt: signIn.signedInAt,
      eventEndTime: params.eventEndTime,
    }),
  }));

  return buildSellerReportMetrics({
    signIns,
    funnelMetrics: params.funnelMetrics,
  });
}

function buildActivitySeries(params: {
  event: typeof events.$inferSelect;
  signIns: Array<typeof signIns.$inferSelect>;
  funnelEvents: Array<typeof publicFunnelEvents.$inferSelect>;
}) {
  const earliestActivity = [
    ...params.signIns.map((item) => item.signedInAt),
    ...params.funnelEvents.map((item) => item.createdAt),
  ].sort((a, b) => a.getTime() - b.getTime())[0] ?? params.event.startTime;

  const latestActivity = [
    ...params.signIns.map((item) => item.signedInAt),
    ...params.funnelEvents.map((item) => item.createdAt),
  ].sort((a, b) => b.getTime() - a.getTime())[0] ?? params.event.endTime;

  const start = startOfDay(
    earliestActivity < params.event.startTime
      ? earliestActivity
      : addDays(params.event.startTime, -1)
  );
  const eventDay = startOfDay(params.event.startTime);
  const baselineEnd = addDays(eventDay, 6);
  const end = startOfDay(
    latestActivity > baselineEnd ? latestActivity : baselineEnd
  );
  const totalDays = Math.max(
    1,
    Math.min(
      10,
      Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )
  );

  return Array.from({ length: totalDays }, (_, index) => {
    const bucketStart = addDays(start, index);
    const bucketEnd = addDays(bucketStart, 1);

    return {
      label: formatDayLabel(bucketStart),
      pageViews: params.funnelEvents.filter(
        (item) =>
          item.stage === "page_view" &&
          item.createdAt >= bucketStart &&
          item.createdAt < bucketEnd
      ).length,
      formStarts: params.funnelEvents.filter(
        (item) =>
          item.stage === "form_start" &&
          item.createdAt >= bucketStart &&
          item.createdAt < bucketEnd
      ).length,
      signIns: params.signIns.filter(
        (item) => item.signedInAt >= bucketStart && item.signedInAt < bucketEnd
      ).length,
    };
  });
}

async function buildSellerReportBenchmark(event: typeof events.$inferSelect) {
  const db = getDb();
  const currentPrice = parseListPrice(event.listPrice);
  const lookbackStart = addDays(event.startTime, -365);

  const candidateEvents = await db
    .select({
      id: events.id,
      uuid: events.uuid,
      propertyAddress: events.propertyAddress,
      listPrice: events.listPrice,
      propertyType: events.propertyType,
      publicMode: events.publicMode,
      endTime: events.endTime,
      startTime: events.startTime,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, event.userId),
        eq(events.publicMode, event.publicMode),
        eq(events.status, "completed"),
        gte(events.startTime, lookbackStart),
        lte(events.startTime, event.startTime)
      )
    )
    .orderBy(desc(events.startTime));

  const filteredByPropertyType = candidateEvents.filter(
    (candidate) =>
      candidate.id !== event.id &&
      (!event.propertyType || candidate.propertyType === event.propertyType)
  );

  const priceBandCandidates =
    currentPrice === null
      ? filteredByPropertyType
      : filteredByPropertyType.filter((candidate) => {
          const candidatePrice = parseListPrice(candidate.listPrice);

          if (candidatePrice === null) {
            return false;
          }

          return candidatePrice >= currentPrice * 0.75 && candidatePrice <= currentPrice * 1.25;
        });

  const comparableEvents =
    priceBandCandidates.length >= 3
      ? priceBandCandidates.slice(0, 12)
      : filteredByPropertyType.slice(0, 12);
  const priceBandApplied = comparableEvents === priceBandCandidates;

  if (comparableEvents.length === 0) {
    return null;
  }

  const eventIds = comparableEvents.map((candidate) => candidate.id);
  const [comparisonSignIns, comparisonFunnels] = await Promise.all([
    db
      .select()
      .from(signIns)
      .where(inArray(signIns.eventId, eventIds)),
    db
      .select()
      .from(publicFunnelEvents)
      .where(inArray(publicFunnelEvents.eventId, eventIds)),
  ]);

  const comparisonByEvent = comparableEvents.map((candidate) => {
    const reportSignIns = comparisonSignIns
      .filter((item) => item.eventId === candidate.id)
      .map(mapSellerReportSignIn);
    const funnelMetrics = {
      uniqueVisitors: comparisonFunnels.filter(
        (item) => item.eventId === candidate.id && item.stage === "page_view"
      ).length,
      uniqueFormStarts: comparisonFunnels.filter(
        (item) => item.eventId === candidate.id && item.stage === "form_start"
      ).length,
    };

    return mapAttributionMetrics({
      eventPublicMode: candidate.publicMode,
      eventEndTime: candidate.endTime,
      signIns: reportSignIns,
      funnelMetrics,
    });
  });

  const signInsMedian = median(
    comparisonByEvent.map((item) => item.openHouseCaptures + item.listingInquiryCaptures)
  );
  const visitorCaptureRateMedian = median(
    comparisonByEvent
      .map((item) => item.uniqueVisitorCaptureRate)
      .filter((item): item is number => item !== null)
  );
  const formCompletionRateMedian = median(
    comparisonByEvent
      .map((item) => item.uniqueFormCompletionRate)
      .filter((item): item is number => item !== null)
  );
  const behaviorQualifiedLeadRateMedian = median(
    comparisonByEvent.map((item) => {
      const totalCaptures = item.openHouseCaptures + item.listingInquiryCaptures;
      return totalCaptures > 0
        ? Math.round((item.behaviorQualifiedLeads.length / totalCaptures) * 100)
        : 0;
    })
  );
  const inquiryShareMedian = median(
    comparisonByEvent.map((item) => item.inquiryShare)
  );

  return {
    comparableEventsCount: comparableEvents.length,
    cohortLabel: buildCohortLabel({
      comparableEventsCount: comparableEvents.length,
      propertyType: event.propertyType,
      publicMode: event.publicMode,
      priceBandApplied,
    }),
    confidence: getBenchmarkConfidence(comparableEvents.length),
    signIns: buildBenchmarkMetric(null, signInsMedian),
    visitorCaptureRate: buildBenchmarkMetric(null, visitorCaptureRateMedian),
    formCompletionRate: buildBenchmarkMetric(null, formCompletionRateMedian),
    behaviorQualifiedLeadRate: buildBenchmarkMetric(null, behaviorQualifiedLeadRateMedian),
    inquiryShare: buildBenchmarkMetric(null, inquiryShareMedian),
  } satisfies SellerReportBenchmark;
}

export async function buildSellerReportEventById(id: number, userId?: number) {
  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(
      userId !== undefined ? and(eq(events.id, id), eq(events.userId, userId)) : eq(events.id, id)
    )
    .limit(1);

  if (!event) return null;

  return buildSellerReportEventFromEvent(event);
}

export async function buildSellerReportEventByUuid(uuid: string) {
  const db = getDb();
  const [event] = await db.select().from(events).where(eq(events.uuid, uuid)).limit(1);

  if (!event) return null;

  return buildSellerReportEventFromEvent(event);
}

async function buildSellerReportEventFromEvent(
  event: typeof events.$inferSelect
): Promise<SellerReportEvent> {
  const db = getDb();
  const [eventSignIns, eventFunnelEvents, benchmark] = await Promise.all([
    db.select().from(signIns).where(eq(signIns.eventId, event.id)),
    db.select().from(publicFunnelEvents).where(eq(publicFunnelEvents.eventId, event.id)),
    buildSellerReportBenchmark(event),
  ]);

  const funnelRows = eventFunnelEvents.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.stage] = (accumulator[row.stage] || 0) + 1;
    return accumulator;
  }, {});

  const uniqueVisitors = funnelRows.page_view ?? 0;
  const uniqueFormStarts = funnelRows.form_start ?? 0;
  const mappedSignIns = eventSignIns.map(mapSellerReportSignIn);
  const metrics = mapAttributionMetrics({
    eventPublicMode: event.publicMode,
    eventEndTime: event.endTime,
    signIns: mappedSignIns,
    funnelMetrics: {
      uniqueVisitors,
      uniqueFormStarts,
    },
  });
  const currentCaptureCount = metrics.openHouseCaptures + metrics.listingInquiryCaptures;
  const currentBehaviorQualifiedRate =
    currentCaptureCount > 0
      ? Math.round((metrics.behaviorQualifiedLeads.length / currentCaptureCount) * 100)
      : 0;
  const hydratedBenchmark =
    benchmark
      ? {
          ...benchmark,
          signIns: buildBenchmarkMetric(currentCaptureCount, benchmark.signIns.median),
          visitorCaptureRate: buildBenchmarkMetric(
            metrics.uniqueVisitorCaptureRate,
            benchmark.visitorCaptureRate.median
          ),
          formCompletionRate: buildBenchmarkMetric(
            metrics.uniqueFormCompletionRate,
            benchmark.formCompletionRate.median
          ),
          behaviorQualifiedLeadRate: buildBenchmarkMetric(
            currentBehaviorQualifiedRate,
            benchmark.behaviorQualifiedLeadRate.median
          ),
          inquiryShare: buildBenchmarkMetric(
            metrics.inquiryShare,
            benchmark.inquiryShare.median
          ),
        }
      : null;

  return {
    id: event.id,
    uuid: event.uuid,
    propertyAddress: event.propertyAddress,
    mlsNumber: event.mlsNumber,
    listPrice: event.listPrice ? String(event.listPrice) : null,
    propertyType: event.propertyType,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    publicMode: event.publicMode,
    status: event.status,
    totalSignIns: event.totalSignIns,
    hotLeadsCount: event.hotLeadsCount,
    bedrooms: event.bedrooms,
    bathrooms: event.bathrooms ? String(event.bathrooms) : null,
    sqft: event.sqft,
    signIns: mappedSignIns,
    funnelMetrics: {
      uniqueVisitors,
      uniqueFormStarts,
    },
    activitySeries: buildActivitySeries({
      event,
      signIns: eventSignIns,
      funnelEvents: eventFunnelEvents,
    }),
    benchmark: hydratedBenchmark,
  };
}
