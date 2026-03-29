import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { events, publicFunnelEvents } from "@/lib/db/schema";
import {
  buildPublicFunnelVisitorCookie,
  buildPublicFunnelStageCookie,
  getPublicFunnelVisitorId,
  hasPublicFunnelStageCookie,
  isTrustedPublicFunnelRequest,
  type PublicFunnelStage,
} from "@/lib/public-funnel";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site";

const bodySchema = z.object({
  stage: z.enum(["page_view", "form_start"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const db = getDb();
  const [event] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.uuid, uuid))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const payload = bodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid funnel payload" }, { status: 400 });
  }

  const stage = payload.data.stage as PublicFunnelStage;
  const trustedRequest = isTrustedPublicFunnelRequest({
    requestOrigin: new URL(request.url).origin,
    siteOrigin: (() => {
      try {
        return new URL(getSiteUrl()).origin;
      } catch {
        return null;
      }
    })(),
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
  });

  if (!trustedRequest) {
    return NextResponse.json({ success: true });
  }

  const rateLimitResult = await checkRateLimit({
    key: `public-funnel:${uuid}:${stage}:${getClientIp(request.headers)}`,
    limit: stage === "page_view" ? 30 : 15,
    windowMs: stage === "page_view" ? 30 * 60 * 1000 : 15 * 60 * 1000,
  });

  if (!rateLimitResult.ok || hasPublicFunnelStageCookie(request.cookies, uuid, stage)) {
    return NextResponse.json({ success: true });
  }

  let visitorId = getPublicFunnelVisitorId(request.cookies, uuid);
  let shouldSetCookie = false;

  if (!visitorId) {
    visitorId = crypto.randomUUID();
    shouldSetCookie = true;
  }

  try {
    await db
      .insert(publicFunnelEvents)
      .values({
        eventId: event.id,
        visitorId,
        stage,
      })
      .onDuplicateKeyUpdate({
        set: {
          createdAt: sql`${publicFunnelEvents.createdAt}`,
        },
      });
  } catch (error) {
    console.error("[PublicFunnel] Tracking write failed:", error);
    return NextResponse.json({ success: true });
  }

  const response = NextResponse.json({ success: true });
  if (shouldSetCookie) {
    response.cookies.set(buildPublicFunnelVisitorCookie(uuid, visitorId));
  }
  response.cookies.set(buildPublicFunnelStageCookie(uuid, stage));

  return response;
}
