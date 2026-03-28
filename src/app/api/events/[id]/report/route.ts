import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getSellerReportAccess } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { buildSellerReportEventById } from "@/lib/seller-report-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const eventId = Number(id);
  const db = getDb();
  const [eventRecord] = await db
    .select({
      id: events.id,
      featureAccessTier: events.featureAccessTier,
      proTrialExpiresAt: events.proTrialExpiresAt,
    })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.userId, Number(session.user.id))))
    .limit(1);

  if (!eventRecord) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const event = await buildSellerReportEventById(eventId, Number(session.user.id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const reportAccess = getSellerReportAccess({
    subscriptionTier: session.user.subscriptionTier,
    accountEmail: session.user.email,
    eventFeatureAccessTier: eventRecord.featureAccessTier,
    proTrialExpiresAt: eventRecord.proTrialExpiresAt,
  });

  return NextResponse.json({
    ...event,
    reportAccess,
  });
}
