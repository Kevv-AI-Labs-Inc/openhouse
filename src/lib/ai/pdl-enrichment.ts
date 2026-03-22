/**
 * People Data Lab enrichment service with caching.
 *
 * - Pro tier: 100 credits/month included
 * - Hard capped at the monthly entitlement
 * - Cache: 90-day TTL to avoid duplicate API calls
 */
import { getDb } from "@/lib/db";
import { pdlCache, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { ensureUsageWindow } from "@/lib/billing";
import { hasPdlCredits } from "@/lib/plans";

const PDL_API_URL = "https://api.peopledatalabs.com/v5/person/enrich";
const CACHE_TTL_DAYS = 90;

export interface PdlEnrichmentResult {
    found: boolean;
    data: Record<string, unknown> | null;
    cached: boolean;
    creditUsed: boolean;
}

/**
 * Enrich a contact with People Data Lab.
 * Checks cache first, then calls PDL API if needed.
 */
export async function enrichContact(
    userId: number,
    identifier: { email?: string; phone?: string }
): Promise<PdlEnrichmentResult> {
    const db = getDb();
    const lookupKey = identifier.email || identifier.phone;
    const lookupType = identifier.email ? "email" : "phone";

    if (!lookupKey) {
        return { found: false, data: null, cached: false, creditUsed: false };
    }

    // 1. Check cache first
    const [cached] = await db
        .select()
        .from(pdlCache)
        .where(
            and(
                eq(pdlCache.lookupKey, lookupKey),
                gt(pdlCache.expiresAt, new Date())
            )
        )
        .limit(1);

    if (cached) {
        return {
            found: true,
            data: cached.data as Record<string, unknown>,
            cached: true,
            creditUsed: false,
        };
    }

    // 2. Check user's credit balance
    const user = await ensureUsageWindow(userId);

    if (!user) {
        return { found: false, data: null, cached: false, creditUsed: false };
    }

    if (user.pdlCreditsLimit <= 0) {
        return { found: false, data: null, cached: false, creditUsed: false };
    }

    if (!hasPdlCredits(user.pdlCreditsUsed, user.pdlCreditsLimit)) {
        return { found: false, data: null, cached: false, creditUsed: false };
    }

    // 3. Call PDL API
    const apiKey = process.env.PDL_API_KEY;
    if (!apiKey) {
        console.warn("[PDL] API key not configured");
        return { found: false, data: null, cached: false, creditUsed: false };
    }

    try {
        const params = new URLSearchParams({
            api_key: apiKey,
            ...(identifier.email ? { email: identifier.email } : {}),
            ...(identifier.phone ? { phone: identifier.phone } : {}),
            min_likelihood: "5",
        });

        const response = await fetch(`${PDL_API_URL}?${params}`, {
            method: "GET",
            headers: { "Accept": "application/json" },
        });

        if (!response.ok) {
            if (response.status === 404) {
                return { found: false, data: null, cached: false, creditUsed: true };
            }
            throw new Error(`PDL API error: ${response.status}`);
        }

        const pdlData = await response.json();

        // 4. Increment user's credit usage
        await db
            .update(users)
            .set({ pdlCreditsUsed: user.pdlCreditsUsed + 1 })
            .where(eq(users.id, userId));

        // 5. Cache the result (90 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

        // Upsert cache entry
        try {
            await db.insert(pdlCache).values({
                lookupKey,
                lookupType,
                data: pdlData,
                expiresAt,
            });
        } catch {
            // If key exists but expired, update it
            await db
                .update(pdlCache)
                .set({ data: pdlData, expiresAt })
                .where(eq(pdlCache.lookupKey, lookupKey));
        }

        // Extract useful fields
        const enrichedData = {
            job_title: pdlData.job_title,
            job_company_name: pdlData.job_company_name,
            job_company_industry: pdlData.job_company_industry,
            inferred_salary: pdlData.inferred_salary,
            location_name: pdlData.location_name,
            linkedin_url: pdlData.linkedin_url,
            facebook_url: pdlData.facebook_url,
            twitter_url: pdlData.twitter_url,
            education: pdlData.education,
            experience: pdlData.experience?.slice(0, 3),
            gender: pdlData.gender,
            birth_year: pdlData.birth_year,
        };

        return {
            found: true,
            data: enrichedData,
            cached: false,
            creditUsed: true,
        };
    } catch (error) {
        console.error("[PDL] Enrichment error:", error);
        return { found: false, data: null, cached: false, creditUsed: false };
    }
}

/**
 * Get PDL usage stats for a user.
 */
export async function getPdlUsage(userId: number) {
    const db = getDb();
    const [user] = await db
        .select({
            used: users.pdlCreditsUsed,
            limit: users.pdlCreditsLimit,
            resetAt: users.usageResetAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) return null;

    const remaining = Math.max(0, user.limit - user.used);

    return {
        used: user.used,
        limit: user.limit,
        remaining,
        resetAt: user.resetAt,
    };
}
