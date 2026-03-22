/**
 * Event CRUD API Routes
 * GET  /api/events       — List all events for the current user
 * POST /api/events       — Create a new event
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
    allocateTrialProLaunch,
    countEventsThisMonth,
    normalizePlanTier,
} from "@/lib/billing";
import { PLAN_LIMITS, hasUsageCap } from "@/lib/plans";
import { publicModes } from "@/lib/listing-import-shared";
import { hasAiConfiguration } from "@/lib/ai/openai";

const createEventSchema = z.object({
    propertyAddress: z.string().min(1, "Property address is required"),
    startTime: z.string().transform((s) => new Date(s)),
    endTime: z.string().transform((s) => new Date(s)),
    publicMode: z.enum(publicModes).optional(),
    mlsNumber: z.string().optional(),
    listPrice: z.string().optional(),
    propertyType: z
        .enum(["single_family", "condo", "townhouse", "multi_family", "land", "other"])
        .optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    sqft: z.number().optional(),
    yearBuilt: z.number().optional(),
    propertyDescription: z.string().optional(),
    customFields: z
        .array(
            z.object({
                label: z.string(),
                type: z.enum(["text", "select"]),
                options: z.array(z.string()).optional(),
            })
        )
        .optional(),
    branding: z
        .object({
            logoUrl: z.string().optional(),
            primaryColor: z.string().optional(),
            tagline: z.string().optional(),
            flyerImageUrl: z.string().optional(),
        })
        .optional(),
    complianceText: z.string().optional(),
    propertyPhotos: z.array(z.string()).optional(),
    aiQaContext: z
        .object({
            customFaq: z
                .array(
                    z.object({
                        question: z.string(),
                        answer: z.string(),
                    })
                )
                .optional(),
            mlsData: z.record(z.string(), z.unknown()).optional(),
            propertyFacts: z.record(z.string(), z.unknown()).optional(),
            nearbyPoi: z.record(z.string(), z.unknown()).optional(),
            agentNotes: z.string().optional(),
        })
        .optional(),
    status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const userEvents = await db
        .select()
        .from(events)
        .where(eq(events.userId, Number(session.user.id)))
        .orderBy(desc(events.startTime));

    return NextResponse.json(userEvents);
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const data = createEventSchema.parse(body);

        const db = getDb();
        const uuid = randomUUID();
        const tier = normalizePlanTier(session.user.subscriptionTier);

        if (tier === "free") {
            const eventsUsed = await countEventsThisMonth(Number(session.user.id));
            const freeEventLimit = PLAN_LIMITS.free.maxEventsPerMonth;

            if (
                hasUsageCap(freeEventLimit) &&
                eventsUsed >= freeEventLimit
            ) {
                return NextResponse.json(
                    { error: "Free plan event launches are temporarily capped. Upgrade to Pro for unlimited automation and team workflows." },
                    { status: 403 }
                );
            }
        }

        const [result] = await db.insert(events).values({
            uuid,
            userId: Number(session.user.id),
            propertyAddress: data.propertyAddress,
            startTime: data.startTime,
            endTime: data.endTime,
            publicMode: data.publicMode || "open_house",
            mlsNumber: data.mlsNumber || null,
            listPrice: data.listPrice || null,
            propertyType: data.propertyType || null,
            bedrooms: data.bedrooms || null,
            bathrooms: data.bathrooms ? String(data.bathrooms) : null,
            sqft: data.sqft || null,
            yearBuilt: data.yearBuilt || null,
            propertyDescription: data.propertyDescription || null,
            customFields: data.customFields || null,
            branding: data.branding || null,
            complianceText: data.complianceText || null,
            propertyPhotos: data.propertyPhotos || null,
            aiQaContext: data.aiQaContext || null,
            featureAccessTier: tier === "pro" ? "pro" : "free",
            status: data.status || "draft",
            aiQaEnabled: false,
            totalSignIns: 0,
            hotLeadsCount: 0,
        });

        if (
            tier === "free" &&
            (data.status === "active" || data.status === "completed")
        ) {
            await allocateTrialProLaunch({
                userId: Number(session.user.id),
                eventId: Number(result.insertId),
                enableAiQa: hasAiConfiguration(),
            });
        }

        return NextResponse.json(
            { id: result.insertId, uuid },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: error.issues[0].message },
                { status: 400 }
            );
        }
        console.error("[Events] Create error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
