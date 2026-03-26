/**
 * Public Event Sign-In API
 * GET  /api/public/event/[uuid]          — Get event info (no auth)
 * POST /api/public/event/[uuid]/sign-in  — Submit sign-in (no auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { events, signIns, users } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { processSignInWithAi } from "@/lib/ai/process-signin";
import { PLAN_LIMITS, hasUsageCap } from "@/lib/plans";
import {
    countSignInsThisMonth,
    ensureUsageWindow,
    hasProFeatureAccess,
    normalizePlanTier,
    resolveFeatureAccessTier,
} from "@/lib/billing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hasAiConfiguration } from "@/lib/ai/openai";
import {
    issuePublicChatAccessGrant,
    resolvePublicChatAccessGrant,
} from "@/lib/public-chat-access";
import { buildPublicListingMarketing } from "@/lib/public-listing-view";
import { publicSignInSchema } from "@/lib/public-signin";
import { upsertFollowUpDraft } from "@/lib/ai/follow-up-workflow";
import { isPublicEventVisible } from "@/lib/public-mode";
import { ZodError } from "zod";

function buildSignInSuccessResponse(params: {
    signInId: number;
    featureAccessTier: string;
    aiQaEnabled: boolean;
    aiProcessed: boolean;
    status: number;
    deduplicated?: boolean;
}) {
    return NextResponse.json(
        {
            signInId: params.signInId,
            success: true,
            aiProcessed: params.aiProcessed,
            chatUnlocked: params.aiQaEnabled,
            featureAccessTier: params.featureAccessTier,
            deduplicated: params.deduplicated ?? false,
        },
        { status: params.status }
    );
}

function isDuplicateSignInError(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as { code?: string; errno?: number };

    return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062;
}

function isMissingClientSubmissionIdColumnError(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as { code?: string; errno?: number };

    return candidate.code === "ER_BAD_FIELD_ERROR" || candidate.errno === 1054;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params;
    const db = getDb();

    const [event] = await db
        .select({
            id: events.id,
            uuid: events.uuid,
            propertyAddress: events.propertyAddress,
            listPrice: events.listPrice,
            startTime: events.startTime,
            endTime: events.endTime,
            publicMode: events.publicMode,
            status: events.status,
            branding: events.branding,
            complianceText: events.complianceText,
            customFields: events.customFields,
            propertyType: events.propertyType,
            bedrooms: events.bedrooms,
            bathrooms: events.bathrooms,
            sqft: events.sqft,
            propertyPhotos: events.propertyPhotos,
            propertyDescription: events.propertyDescription,
            aiQaEnabled: events.aiQaEnabled,
            aiQaContext: events.aiQaContext,
            featureAccessTier: events.featureAccessTier,
            proTrialExpiresAt: events.proTrialExpiresAt,
            userId: events.userId,
        })
        .from(events)
        .where(eq(events.uuid, uuid))
        .limit(1);

    if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!isPublicEventVisible(event.status)) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [owner] = await db
        .select({
            subscriptionTier: users.subscriptionTier,
        })
        .from(users)
        .where(eq(users.id, event.userId))
        .limit(1);

    const featureAccessTier = resolveFeatureAccessTier({
        subscriptionTier: owner?.subscriptionTier,
        eventFeatureAccessTier: event.featureAccessTier,
        proTrialExpiresAt: event.proTrialExpiresAt,
    });
    const aiQaEnabled =
        event.aiQaEnabled &&
        hasProFeatureAccess({
            subscriptionTier: owner?.subscriptionTier,
            eventFeatureAccessTier: event.featureAccessTier,
            proTrialExpiresAt: event.proTrialExpiresAt,
        }) &&
        hasAiConfiguration();
    const aiQaContext = event.aiQaContext as {
        customFaq?: Array<{ question: string; answer: string }>;
        mlsData?: Record<string, unknown>;
        propertyFacts?: Record<string, unknown>;
        nearbyPoi?: Record<string, unknown>;
    } | null;
    const marketing = buildPublicListingMarketing({
        propertyAddress: event.propertyAddress,
        propertyType: event.propertyType,
        bedrooms: event.bedrooms,
        bathrooms: event.bathrooms,
        sqft: event.sqft,
        propertyDescription: event.propertyDescription,
        aiQaContext,
    });
    const chatAccess = aiQaEnabled
        ? await resolvePublicChatAccessGrant(db, {
              cookieStore: request.cookies,
              uuid,
              eventId: event.id,
          })
        : null;

    return NextResponse.json({
        uuid: event.uuid,
        propertyAddress: event.propertyAddress,
        listPrice: event.listPrice,
        startTime: event.startTime,
        endTime: event.endTime,
        publicMode: event.publicMode,
        status: event.status,
        branding: event.branding,
        complianceText: event.complianceText,
        customFields: event.customFields,
        propertyType: event.propertyType,
        bedrooms: event.bedrooms,
        bathrooms: event.bathrooms,
        sqft: event.sqft,
        propertyPhotos: event.propertyPhotos,
        propertyDescription: event.propertyDescription,
        featureAccessTier,
        aiQaEnabled,
        aiQaOnProPreview: featureAccessTier === "free" && hasAiConfiguration(),
        chatUnlocked: Boolean(chatAccess),
        marketing,
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params;
    const db = getDb();

    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.uuid, uuid))
        .limit(1);

    if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.status === "cancelled") {
        return NextResponse.json(
            { error: "This open house has been cancelled" },
            { status: 400 }
        );
    }

    if (event.status === "draft") {
        return NextResponse.json(
            { error: "This open house is not published yet" },
            { status: 400 }
        );
    }

    const [ownerRecord] = await db
        .select({
            id: users.id,
            subscriptionTier: users.subscriptionTier,
        })
        .from(users)
        .where(eq(users.id, event.userId))
        .limit(1);

    if (!ownerRecord) {
        return NextResponse.json({ error: "Event owner not found" }, { status: 404 });
    }

    const owner = await ensureUsageWindow(ownerRecord.id);

    if (!owner) {
        return NextResponse.json({ error: "Event owner not found" }, { status: 404 });
    }

    try {
        const body = await request.json();
        const data = publicSignInSchema.parse(body);
        const isKioskRequest = request.headers.get("x-openhouse-kiosk") === "1";
        const tier = normalizePlanTier(owner.subscriptionTier);
        const featureAccessTier = resolveFeatureAccessTier({
            subscriptionTier: owner.subscriptionTier,
            eventFeatureAccessTier: event.featureAccessTier,
            proTrialExpiresAt: event.proTrialExpiresAt,
        });
        const hasProFeatures = featureAccessTier !== "free";
        const aiQaEnabled =
            event.aiQaEnabled &&
            hasProFeatures &&
            hasAiConfiguration();

        let existingSignIn: { id: number } | undefined;

        if (data.clientSubmissionId) {
            try {
                [existingSignIn] = await db
                    .select({ id: signIns.id })
                    .from(signIns)
                    .where(
                        and(
                            eq(signIns.eventId, event.id),
                            eq(signIns.clientSubmissionId, data.clientSubmissionId)
                        )
                    )
                    .limit(1);
            } catch (lookupError) {
                if (!isMissingClientSubmissionIdColumnError(lookupError)) {
                    throw lookupError;
                }

                console.warn("[SignIn] clientSubmissionId column missing; duplicate protection is disabled until migration runs.");
            }
        }

        if (existingSignIn) {
            return buildSignInSuccessResponse({
                signInId: existingSignIn.id,
                featureAccessTier,
                aiQaEnabled,
                aiProcessed: hasProFeatures,
                status: 200,
                deduplicated: true,
            });
        }

        const rateLimitResult = await checkRateLimit({
            key: `${isKioskRequest ? "public-kiosk-signin" : "public-signin"}:${uuid}:${getClientIp(request.headers)}`,
            limit: isKioskRequest ? 60 : 12,
            windowMs: 10 * 60 * 1000,
        });

        if (!rateLimitResult.ok) {
            return NextResponse.json(
                { error: "Too many sign-in attempts. Please try again shortly." },
                { status: 429 }
            );
        }

        if (tier === "free" && !hasProFeatures) {
            const signInsUsed = await countSignInsThisMonth(owner.id);
            const freeSignInLimit = PLAN_LIMITS.free.maxSignInsPerMonth;

            if (
                hasUsageCap(freeSignInLimit) &&
                signInsUsed >= freeSignInLimit
            ) {
                return NextResponse.json(
                    { error: "This listing has reached the Free monthly capture limit. Upgrade to Pro for unlimited sign-ins." },
                    { status: 403 }
                );
            }
        }

        const insertValues = {
            eventId: event.id,
            fullName: data.fullName,
            phone: data.phone,
            email: data.email,
            clientSubmissionId: data.clientSubmissionId ?? null,
            captureMode: event.publicMode,
            hasAgent: data.hasAgent ?? false,
            isPreApproved: data.isPreApproved || "not_yet",
            interestLevel: data.interestLevel || "just_looking",
            buyingTimeline: data.buyingTimeline || null,
            priceRange: data.priceRange || null,
            customAnswers: data.customAnswers || null,
            followUpSent: false,
            crmSyncStatus: "pending" as const,
        };

        let signInId: number | null = null;

        try {
            const [result] = await db.insert(signIns).values(insertValues);

            signInId = Number(result.insertId);
        } catch (insertError) {
            if (data.clientSubmissionId && isMissingClientSubmissionIdColumnError(insertError)) {
                console.warn("[SignIn] clientSubmissionId column missing; retrying insert without offline deduplication metadata.");

                const legacyInsertValues = {
                    eventId: insertValues.eventId,
                    fullName: insertValues.fullName,
                    phone: insertValues.phone,
                    email: insertValues.email,
                    captureMode: insertValues.captureMode,
                    hasAgent: insertValues.hasAgent,
                    isPreApproved: insertValues.isPreApproved,
                    interestLevel: insertValues.interestLevel,
                    buyingTimeline: insertValues.buyingTimeline,
                    priceRange: insertValues.priceRange,
                    customAnswers: insertValues.customAnswers,
                    followUpSent: insertValues.followUpSent,
                    crmSyncStatus: insertValues.crmSyncStatus,
                };
                const [legacyResult] = await db.insert(signIns).values(legacyInsertValues);

                signInId = Number(legacyResult.insertId);
            } else if (data.clientSubmissionId && isDuplicateSignInError(insertError)) {
                const [existingSignInAfterDuplicate] = await db
                    .select({ id: signIns.id })
                    .from(signIns)
                    .where(
                        and(
                            eq(signIns.eventId, event.id),
                            eq(signIns.clientSubmissionId, data.clientSubmissionId)
                        )
                    )
                    .limit(1);

                if (existingSignInAfterDuplicate) {
                    return buildSignInSuccessResponse({
                        signInId: existingSignInAfterDuplicate.id,
                        featureAccessTier,
                        aiQaEnabled,
                        aiProcessed: hasProFeatures,
                        status: 200,
                        deduplicated: true,
                    });
                }
            } else {
                throw insertError;
            }
        }

        if (!signInId) {
            throw new Error("Failed to persist sign-in");
        }

        await db
            .update(events)
            .set({ totalSignIns: sql`${events.totalSignIns} + 1` })
            .where(eq(events.id, event.id));

        if (hasProFeatures) {
            try {
                await processSignInWithAi({
                    eventId: event.id,
                    signInId,
                    subscriptionTier: "pro",
                    trigger: "sign_in",
                });
            } catch (processingError) {
                console.error("[SignIn] Auto AI processing failed:", processingError);
            }

            try {
                await upsertFollowUpDraft({
                    eventId: event.id,
                    signInId,
                    generationSource: "auto_sign_in",
                });
            } catch (draftError) {
                console.error("[SignIn] Auto follow-up draft failed:", draftError);
            }
        }
        const response = buildSignInSuccessResponse({
            signInId,
            featureAccessTier,
            aiQaEnabled,
            aiProcessed: hasProFeatures,
            status: 201,
        });

        if (aiQaEnabled) {
            try {
                const grant = await issuePublicChatAccessGrant(db, {
                    uuid,
                    eventId: event.id,
                    signInId,
                });
                response.cookies.set(grant.cookie);
            } catch (grantError) {
                console.error("[SignIn] Public chat grant issuance failed:", grantError);
            }
        }

        return response;
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: error.issues[0].message },
                { status: 400 }
            );
        }
        console.error("[SignIn] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
