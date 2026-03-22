/**
 * Property Q&A Chatbot API
 * GET  /api/public/event/[uuid]/chat?sessionId=xxx — Load persisted messages
 * POST /api/public/event/[uuid]/chat               — Chat with property AI
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
    events,
    aiConversations,
    users,
    type Event,
    type User,
} from "@/lib/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { chatWithProperty } from "@/lib/ai/property-qa";
import type { PropertyQaSource } from "@/lib/db/schema";
import { getAiDeploymentName, hasAiConfiguration } from "@/lib/ai/openai";
import { randomUUID } from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureUsageWindow, hasProFeatureAccess, resolveFeatureAccessTier } from "@/lib/billing";
import { resolvePublicChatAccessGrant } from "@/lib/public-chat-access";
import { hasUnlimitedAiQueries } from "@/lib/plans";
import { processSignInWithAi } from "@/lib/ai/process-signin";
import { upsertFollowUpDraft } from "@/lib/ai/follow-up-workflow";
import { isPublicEventVisible } from "@/lib/public-mode";

type EligibleContext =
    | {
          ok: true;
          event: Event;
          owner: User;
          featureAccessTier: "free" | "trial_pro" | "pro";
          signInId: number | null;
      }
    | { ok: false; response: NextResponse };

type ChatHistoryItem = {
    role: "user" | "assistant";
    content: string;
    sources?: PropertyQaSource[];
};

async function loadEligibleContext(request: NextRequest, uuid: string): Promise<EligibleContext> {
    const db = getDb();

    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.uuid, uuid))
        .limit(1);

    if (!event) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Event not found" }, { status: 404 }),
        };
    }

    if (!isPublicEventVisible(event.status)) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Event not found" }, { status: 404 }),
        };
    }

    if (!event.aiQaEnabled) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "AI Q&A not enabled for this event" },
                { status: 403 }
            ),
        };
    }

    const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, event.userId))
        .limit(1);

    const featureAccessTier = resolveFeatureAccessTier({
        subscriptionTier: owner?.subscriptionTier,
        eventFeatureAccessTier: event.featureAccessTier,
        proTrialExpiresAt: event.proTrialExpiresAt,
    });

    if (
        !owner ||
        !hasProFeatureAccess({
            subscriptionTier: owner.subscriptionTier,
            eventFeatureAccessTier: event.featureAccessTier,
            proTrialExpiresAt: event.proTrialExpiresAt,
        })
    ) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "AI Q&A is included on Pro and on your first 3 published trial launches" },
                { status: 403 }
            ),
        };
    }

    if (!hasAiConfiguration()) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "AI Q&A is not configured for this environment" },
                { status: 503 }
            ),
        };
    }

    const access = await resolvePublicChatAccessGrant(db, {
        cookieStore: request.cookies,
        uuid,
        eventId: event.id,
    });

    if (!access) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Share contact details first to use property Q&A for this listing" },
                { status: 403 }
            ),
        };
    }

    return { ok: true, event, owner, featureAccessTier, signInId: access.signInId };
}

async function loadPersistedHistory(eventId: number, sessionId: string): Promise<ChatHistoryItem[]> {
    const db = getDb();
    const rows = await db
        .select({
            role: aiConversations.role,
            content: aiConversations.content,
            sources: aiConversations.sources,
        })
        .from(aiConversations)
        .where(
            and(
                eq(aiConversations.eventId, eventId),
                eq(aiConversations.sessionId, sessionId)
            )
        )
        .orderBy(asc(aiConversations.createdAt))
        .limit(30);

    return rows
        .filter((item) => item.role === "user" || item.role === "assistant")
        .map((item) => ({
            role: item.role as "user" | "assistant",
            content: item.content,
            sources: Array.isArray(item.sources) ? item.sources : undefined,
        }));
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params;
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const context = await loadEligibleContext(request, uuid);
    if (!context.ok) return context.response;

    const messages = await loadPersistedHistory(context.event.id, sessionId);

    return NextResponse.json({ sessionId, messages });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ uuid: string }> }
) {
    const { uuid } = await params;
    const db = getDb();
    const context = await loadEligibleContext(request, uuid);
    if (!context.ok) return context.response;
    const { event, featureAccessTier, signInId } = context;
    const owner = await ensureUsageWindow(context.owner.id);

    if (!owner) {
        return NextResponse.json({ error: "Event owner not found" }, { status: 404 });
    }

    const rateLimitResult = await checkRateLimit({
        key: `public-chat:${uuid}:${getClientIp(request.headers)}`,
        limit: 30,
        windowMs: 10 * 60 * 1000,
    });

    if (!rateLimitResult.ok) {
        return NextResponse.json(
            { error: "Too many AI messages. Please try again shortly." },
            { status: 429 }
        );
    }

    const unlimitedAiQueries =
        featureAccessTier === "trial_pro" || hasUnlimitedAiQueries(owner.aiQueriesLimit);

    if (featureAccessTier !== "trial_pro" && owner.aiQueriesLimit === 0) {
        return NextResponse.json(
            { error: "AI usage is not provisioned for this account" },
            { status: 403 }
        );
    }

    if (!unlimitedAiQueries && owner.aiQueriesUsed >= owner.aiQueriesLimit) {
        return NextResponse.json({ error: "AI query limit reached" }, { status: 429 });
    }

    const body = await request.json();
    const { message, sessionId: existingSessionId, history } = body;

    if (!message || typeof message !== "string") {
        return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const sessionId = existingSessionId || randomUUID();
    const incomingHistory: ChatHistoryItem[] = Array.isArray(history)
        ? history
            .filter(
                (
                    item: unknown
                ): item is { role: "user" | "assistant"; content: string } =>
                    !!item &&
                    typeof item === "object" &&
                    ("role" in item) &&
                    ("content" in item) &&
                    (item.role === "user" || item.role === "assistant") &&
                    typeof item.content === "string"
            )
            .map((item) => ({ role: item.role, content: item.content }))
            .slice(-20)
        : [];

    const conversationHistory =
        incomingHistory.length > 0
            ? incomingHistory
            : await loadPersistedHistory(event.id, sessionId);

    const aiQaContext = event.aiQaContext as {
        customFaq?: Array<{ question: string; answer: string }>;
        mlsData?: Record<string, unknown>;
        propertyFacts?: Record<string, unknown>;
        nearbyPoi?: Record<string, unknown>;
        agentNotes?: string;
    } | null;

    try {
        const result = await chatWithProperty(
            {
                propertyAddress: event.propertyAddress,
                listPrice: event.listPrice,
                propertyType: event.propertyType,
                bedrooms: event.bedrooms,
                bathrooms: event.bathrooms,
                sqft: event.sqft,
                yearBuilt: event.yearBuilt,
                propertyDescription: event.propertyDescription,
                customFaq: aiQaContext?.customFaq,
                mlsData: aiQaContext?.mlsData,
                propertyFacts: aiQaContext?.propertyFacts,
                nearbyPoi: aiQaContext?.nearbyPoi,
                agentNotes: aiQaContext?.agentNotes,
            },
            message,
            conversationHistory
        );

        // Save conversation
        await db.insert(aiConversations).values([
            {
                eventId: event.id,
                signInId,
                sessionId,
                role: "user",
                content: message,
                tokensUsed: 0,
            },
            {
                eventId: event.id,
                signInId,
                sessionId,
                role: "assistant",
                content: result.reply,
                sources: result.sources,
                tokensUsed: result.tokensUsed,
                model: getAiDeploymentName(),
            },
        ]);

        // Increment AI usage
        await db
            .update(users)
            .set({ aiQueriesUsed: sql`${users.aiQueriesUsed} + 1` })
            .where(eq(users.id, owner.id));

        if (signInId) {
            try {
                await processSignInWithAi({
                    eventId: event.id,
                    signInId,
                    subscriptionTier: featureAccessTier === "free" ? owner.subscriptionTier : "pro",
                    trigger: "chat",
                });
            } catch (scoringError) {
                console.error("[Chat] Lead rescoring failed:", scoringError);
            }

            try {
                await upsertFollowUpDraft({
                    eventId: event.id,
                    signInId,
                    generationSource: "auto_chat",
                });
            } catch (draftError) {
                console.error("[Chat] Follow-up draft refresh failed:", draftError);
            }
        }

        return NextResponse.json({
            reply: result.reply,
            sources: result.sources,
            sessionId,
            tokensUsed: result.tokensUsed,
            featureAccessTier,
        });
    } catch (error) {
        console.error("[Chat] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate response" },
            { status: 500 }
        );
    }
}
