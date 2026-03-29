/**
 * Single Event API Routes
 * GET    /api/events/[id]  — Get event details
 * PUT    /api/events/[id]  — Update event
 * DELETE /api/events/[id]  — Delete event
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events, publicChatAccessGrants, signIns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
    allocateTrialProLaunch,
    hasProFeatureAccess,
    normalizePlanTier,
} from "@/lib/billing";
import { hasAiConfiguration } from "@/lib/ai/openai";
import { getPropertyQaInsights } from "@/lib/property-qa-insights";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();
    const [event] = await db
        .select()
        .from(events)
        .where(
            and(
                eq(events.id, Number(id)),
                eq(events.userId, Number(session.user.id))
            )
        )
        .limit(1);

    if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Also fetch sign-ins for the event
    const eventSignIns = await db
        .select()
        .from(signIns)
        .where(eq(signIns.eventId, event.id));

    return NextResponse.json({ ...event, signIns: eventSignIns });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    // Verify ownership
    const [existing] = await db
        .select()
        .from(events)
        .where(
            and(
                eq(events.id, Number(id)),
                eq(events.userId, Number(session.user.id))
            )
        )
        .limit(1);

    if (!existing) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const tier = normalizePlanTier(session.user.subscriptionTier);
    const currentHasProFeatures = hasProFeatureAccess({
        subscriptionTier: session.user.subscriptionTier,
        eventFeatureAccessTier: existing.featureAccessTier,
        proTrialExpiresAt: existing.proTrialExpiresAt,
    });

    if (body.aiQaEnabled === true && !currentHasProFeatures) {
        return NextResponse.json(
            { error: "AI property Q&A is included on Pro and on your first 3 published trial launches" },
            { status: 403 }
        );
    }

    if (body.aiQaEnabled === true && !hasAiConfiguration()) {
        return NextResponse.json(
            { error: "AI is not configured for this environment" },
            { status: 400 }
        );
    }

    // Build update object — only update provided fields
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
        "propertyAddress", "startTime", "endTime", "publicMode", "mlsNumber", "listPrice",
        "propertyType", "bedrooms", "bathrooms", "sqft", "yearBuilt",
        "propertyDescription", "customFields", "branding", "complianceText",
        "status", "aiQaEnabled", "aiQaContext", "propertyPhotos",
    ];

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            if (field === "startTime" || field === "endTime") {
                updateData[field] = new Date(body[field]);
            } else {
                updateData[field] = body[field];
            }
        }
    }

    if (Object.keys(updateData).length > 0) {
        await db
            .update(events)
            .set(updateData)
            .where(eq(events.id, Number(id)));
    }

    const nextStatus = body.status ?? existing.status;
    if (
        tier === "free" &&
        existing.featureAccessTier === "free" &&
        (nextStatus === "active" || nextStatus === "completed")
    ) {
        await allocateTrialProLaunch({
            userId: Number(session.user.id),
            eventId: Number(id),
            enableAiQa: hasAiConfiguration(),
        });
    }

    const nextEventShape = {
        propertyAddress: (updateData.propertyAddress as string | undefined) ?? existing.propertyAddress,
        listPrice:
            (updateData.listPrice as string | null | undefined) ??
            (existing.listPrice ? String(existing.listPrice) : null),
        propertyDescription:
            (updateData.propertyDescription as string | null | undefined) ??
            existing.propertyDescription,
        bedrooms: (updateData.bedrooms as number | null | undefined) ?? existing.bedrooms,
        bathrooms:
            (updateData.bathrooms as string | null | undefined) ??
            (existing.bathrooms ? String(existing.bathrooms) : null),
        sqft: (updateData.sqft as number | null | undefined) ?? existing.sqft,
        yearBuilt: (updateData.yearBuilt as number | null | undefined) ?? existing.yearBuilt,
        aiQaContext:
            (updateData.aiQaContext as
                | {
                      customFaq?: Array<{ question: string; answer: string }>;
                      mlsData?: Record<string, unknown>;
                      propertyFacts?: Record<string, unknown>;
                      nearbyPoi?: Record<string, unknown>;
                      agentNotes?: string;
                  }
                | null
                | undefined) ?? existing.aiQaContext,
    };
    const qaCoverage = getPropertyQaInsights(nextEventShape);
    const nextAiQaEnabled =
        typeof body.aiQaEnabled === "boolean" ? body.aiQaEnabled : existing.aiQaEnabled;
    const publishWarnings =
        nextAiQaEnabled &&
        (nextStatus === "active" || nextStatus === "completed") &&
        qaCoverage.publishReadiness.status !== "ready"
            ? qaCoverage.publishReadiness.warnings
            : [];

    return NextResponse.json({
        success: true,
        qaCoverage,
        warnings: publishWarnings,
    });
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    const [existing] = await db
        .select()
        .from(events)
        .where(
            and(
                eq(events.id, Number(id)),
                eq(events.userId, Number(session.user.id))
            )
        )
        .limit(1);

    if (!existing) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Delete sign-ins first, then event
    await db.delete(signIns).where(eq(signIns.eventId, Number(id)));
    await db
        .delete(publicChatAccessGrants)
        .where(eq(publicChatAccessGrants.eventId, Number(id)))
        .catch(() => {});
    await db.delete(events).where(eq(events.id, Number(id)));

    return NextResponse.json({ success: true });
}
