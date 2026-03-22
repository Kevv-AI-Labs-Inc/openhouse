import { and, eq } from "drizzle-orm";
import { generateFollowUpEmail } from "@/lib/ai/follow-up";
import type { LeadScore } from "@/lib/ai/lead-scoring";
import { getDb } from "@/lib/db";
import { events, signIns, users } from "@/lib/db/schema";
import {
  serializeStoredFollowUpDraft,
  type StoredFollowUpDraft,
} from "@/lib/follow-up-draft";

function extractBehaviorSignals(leadScore: LeadScore | null) {
  if (
    !leadScore?.signals ||
    typeof leadScore.signals !== "object" ||
    !("behavior" in leadScore.signals) ||
    !leadScore.signals.behavior ||
    typeof leadScore.signals.behavior !== "object"
  ) {
    return null;
  }

  const behavior = leadScore.signals.behavior as Record<string, unknown>;

  return {
    userMessageCount:
      typeof behavior.userMessageCount === "number" ? behavior.userMessageCount : 0,
    sessionCount: typeof behavior.sessionCount === "number" ? behavior.sessionCount : 0,
    questionCategories: Array.isArray(behavior.questionCategories)
      ? behavior.questionCategories.filter((item): item is string => typeof item === "string")
      : [],
    actionIntents: Array.isArray(behavior.actionIntents)
      ? behavior.actionIntents.filter((item): item is string => typeof item === "string")
      : [],
    recentQuestionHighlights: Array.isArray(behavior.recentQuestionHighlights)
      ? behavior.recentQuestionHighlights.filter((item): item is string => typeof item === "string")
      : [],
    followUpLikelihood:
      typeof behavior.followUpLikelihood === "string" ? behavior.followUpLikelihood : undefined,
  };
}

export async function upsertFollowUpDraft(params: {
  eventId: number;
  signInId: number;
  generationSource: StoredFollowUpDraft["generationSource"];
}) {
  const db = getDb();

  const [record] = await db
    .select({
      signIn: signIns,
      event: {
        propertyAddress: events.propertyAddress,
        propertyType: events.propertyType,
        listPrice: events.listPrice,
      },
      agent: {
        fullName: users.fullName,
      },
    })
    .from(signIns)
    .innerJoin(events, eq(events.id, signIns.eventId))
    .innerJoin(users, eq(users.id, events.userId))
    .where(and(eq(signIns.id, params.signInId), eq(signIns.eventId, params.eventId)))
    .limit(1);

  if (!record?.signIn.email || record.signIn.followUpSent) {
    return null;
  }

  const generated = await generateFollowUpEmail({
    agentName: record.agent.fullName || "Your Agent",
    propertyAddress: record.event.propertyAddress,
    propertyType: record.event.propertyType,
    listPrice: record.event.listPrice,
    visitorName: record.signIn.fullName,
    visitorEmail: record.signIn.email,
    interestLevel: record.signIn.interestLevel,
    buyingTimeline: record.signIn.buyingTimeline,
    hasAgent: record.signIn.hasAgent ?? false,
    isPreApproved: record.signIn.isPreApproved,
    leadScore: record.signIn.leadScore as LeadScore | null,
    behavior: extractBehaviorSignals(record.signIn.leadScore as LeadScore | null),
  });

  const draft: StoredFollowUpDraft = {
    subject: generated.subject,
    body: generated.body,
    deliveryMode: "draft",
    generatedAt: new Date().toISOString(),
    generationSource: params.generationSource,
  };

  await db
    .update(signIns)
    .set({
      followUpContent: serializeStoredFollowUpDraft(draft),
      followUpSent: false,
      followUpSentAt: null,
    })
    .where(eq(signIns.id, record.signIn.id));

  return draft;
}
