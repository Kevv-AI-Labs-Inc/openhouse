import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiConversations, events, signIns } from "@/lib/db/schema";
import {
    analyzeConversationBehavior,
    buildGptScoringPrompt,
    calculateRuleBasedScore,
    mergeGptScore,
    shouldRunGptLeadScoring,
    type LeadScore,
} from "@/lib/ai/lead-scoring";
import { chatCompletion } from "@/lib/ai/openai";
import { markSignInPendingKevvSync } from "@/lib/kevv-sync";
import { isPro } from "@/lib/plans";

interface ProcessSignInOptions {
    eventId: number;
    signInId: number;
    subscriptionTier: string;
    trigger?: "sign_in" | "chat" | "manual";
}

export interface ProcessSignInResult {
    score: LeadScore;
    enhanced: boolean;
}

export async function processSignInWithAi({
    eventId,
    signInId,
    subscriptionTier,
    trigger = "sign_in",
}: ProcessSignInOptions): Promise<ProcessSignInResult> {
    const db = getDb();

    const [signIn] = await db
        .select()
        .from(signIns)
        .where(and(eq(signIns.id, signInId), eq(signIns.eventId, eventId)))
        .limit(1);

    if (!signIn) {
        throw new Error("Sign-in not found");
    }

    const conversationRows = await db
        .select({
            role: aiConversations.role,
            content: aiConversations.content,
            sessionId: aiConversations.sessionId,
            createdAt: aiConversations.createdAt,
        })
        .from(aiConversations)
        .where(
            and(eq(aiConversations.eventId, eventId), eq(aiConversations.signInId, signInId))
        )
        .orderBy(asc(aiConversations.createdAt));

    const behavior = analyzeConversationBehavior(
        conversationRows.map((row) => ({
            role: row.role,
            content: row.content,
            sessionId: row.sessionId,
            createdAt: row.createdAt,
        }))
    );

    const userIsPro = isPro(subscriptionTier);

    // Phase 1: Rule-based scoring (always)
    const ruleScore = calculateRuleBasedScore({
        fullName: signIn.fullName,
        phone: signIn.phone,
        email: signIn.email,
        hasAgent: signIn.hasAgent ?? false,
        isPreApproved: signIn.isPreApproved,
        interestLevel: signIn.interestLevel,
        buyingTimeline: signIn.buyingTimeline,
        priceRange: signIn.priceRange,
        customAnswers: signIn.customAnswers as Record<string, string> | null,
        signedInAt: signIn.signedInAt,
    }, behavior);

    let finalScore = ruleScore;
    if (userIsPro && shouldRunGptLeadScoring(behavior, trigger)) {
        // Phase 2: GPT enhanced scoring (Pro only)
        try {
            const gptPrompt = buildGptScoringPrompt(
                {
                    fullName: signIn.fullName,
                    phone: signIn.phone,
                    email: signIn.email,
                    hasAgent: signIn.hasAgent ?? false,
                    isPreApproved: signIn.isPreApproved,
                    interestLevel: signIn.interestLevel,
                    buyingTimeline: signIn.buyingTimeline,
                    priceRange: signIn.priceRange,
                    customAnswers: signIn.customAnswers as Record<string, string> | null,
                    signedInAt: signIn.signedInAt,
                },
                ruleScore,
                behavior
            );

            const gptResult = await chatCompletion({
                messages: [{ role: "user", content: gptPrompt }],
                maxTokens: 500,
                temperature: 0.3,
                responseFormat: "json",
            });

            const gptResponse = JSON.parse(gptResult.content);
            finalScore = mergeGptScore(ruleScore, gptResponse);
        } catch (error) {
            console.error("[AI] GPT scoring failed, using rule-based score:", error);
        }
    }

    await db
        .update(signIns)
        .set({
            leadScore: finalScore,
            leadTier: finalScore.tier,
            aiRecommendation: finalScore.recommendation,
        })
        .where(eq(signIns.id, signInId));

    // Keep event hot-lead stats always in sync.
    const hotLeads = await db
        .select({ id: signIns.id })
        .from(signIns)
        .where(and(eq(signIns.eventId, eventId), eq(signIns.leadTier, "hot")));

    await db
        .update(events)
        .set({ hotLeadsCount: hotLeads.length })
        .where(eq(events.id, eventId));

    await markSignInPendingKevvSync(signInId).catch((error) => {
        console.error("[KevvSync] Failed to re-queue sign-in after AI scoring:", error);
    });

    return {
        score: finalScore,
        enhanced: userIsPro,
    };
}
