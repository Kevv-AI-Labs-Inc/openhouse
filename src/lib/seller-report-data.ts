import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, publicFunnelEvents, signIns } from "@/lib/db/schema";
import type { SellerReportEvent, SellerReportSignIn } from "@/lib/seller-report";

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
  const eventSignIns = await db.select().from(signIns).where(eq(signIns.eventId, event.id));
  const funnelRows = await db
    .select({
      stage: publicFunnelEvents.stage,
      count: sql<number>`count(*)`,
    })
    .from(publicFunnelEvents)
    .where(eq(publicFunnelEvents.eventId, event.id))
    .groupBy(publicFunnelEvents.stage);

  const uniqueVisitors =
    funnelRows.find((row) => row.stage === "page_view")?.count ?? 0;
  const uniqueFormStarts =
    funnelRows.find((row) => row.stage === "form_start")?.count ?? 0;

  return {
    id: event.id,
    uuid: event.uuid,
    propertyAddress: event.propertyAddress,
    mlsNumber: event.mlsNumber,
    listPrice: event.listPrice ? String(event.listPrice) : null,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    publicMode: event.publicMode,
    status: event.status,
    totalSignIns: event.totalSignIns,
    hotLeadsCount: event.hotLeadsCount,
    bedrooms: event.bedrooms,
    bathrooms: event.bathrooms ? String(event.bathrooms) : null,
    sqft: event.sqft,
    signIns: eventSignIns.map(mapSellerReportSignIn),
    funnelMetrics: {
      uniqueVisitors,
      uniqueFormStarts,
    },
  };
}
