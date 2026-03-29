/**
 * AI Follow-Up Email API
 * POST /api/events/[id]/follow-up — Generate and optionally send follow-up emails
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events, signIns, users } from "@/lib/db/schema";
import { generateFollowUpEmail } from "@/lib/ai/follow-up";
import type { LeadScore } from "@/lib/ai/lead-scoring";
import { hasProFeatureAccess } from "@/lib/billing";
import {
  GmailIntegrationError,
  isGmailDirectSendAvailable,
  sendViaGmail,
} from "@/lib/gmail";
import {
  MicrosoftIntegrationError,
  isMicrosoftDirectSendAvailable,
  sendViaMicrosoft,
} from "@/lib/microsoft";
import { isEmailRelayConfigured, sendViaCustomDomainRelay } from "@/lib/email";
import {
  type FollowUpEmailMode,
  resolveEffectiveFollowUpMode,
} from "@/lib/follow-up-email";
import {
  parseStoredFollowUpDraft,
  serializeStoredFollowUpDraft,
} from "@/lib/follow-up-draft";
import { markSignInPendingKevvSync } from "@/lib/kevv-sync";

type DeliveryMode = FollowUpEmailMode;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    signInId,
    signInIds,
    drafts,
    send = true,
  }: {
    signInId?: number;
    signInIds?: number[];
    drafts?: Array<{ signInId: number; subject: string; body: string }>;
    send?: boolean;
  } = body;

  const db = getDb();
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, Number(id)), eq(events.userId, Number(session.user.id))))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (
    !hasProFeatureAccess({
      subscriptionTier: session.user.subscriptionTier,
      eventFeatureAccessTier: event.featureAccessTier,
      proTrialExpiresAt: event.proTrialExpiresAt,
    })
  ) {
    return NextResponse.json(
      { error: "AI follow-up is included on Pro and on your first 3 published trial launches" },
      { status: 403 }
    );
  }

  const [agent] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      subscriptionTier: users.subscriptionTier,
      followUpEmailMode: users.followUpEmailMode,
      gmailRefreshTokenEncrypted: users.gmailRefreshTokenEncrypted,
      gmailSendAsEmail: users.gmailSendAsEmail,
      gmailSendingEnabled: users.gmailSendingEnabled,
      microsoftRefreshTokenEncrypted: users.microsoftRefreshTokenEncrypted,
      microsoftSendAsEmail: users.microsoftSendAsEmail,
      microsoftSendingEnabled: users.microsoftSendingEnabled,
      customSendingDomain: users.customSendingDomain,
      customSendingDomainStatus: users.customSendingDomainStatus,
      customSendingFromEmail: users.customSendingFromEmail,
      customSendingFromName: users.customSendingFromName,
      customSendingReplyToEmail: users.customSendingReplyToEmail,
    })
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);

  const requestedIds = Array.isArray(signInIds)
    ? signInIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const draftOverrides = new Map(
    (Array.isArray(drafts) ? drafts : [])
      .map((draft) => ({
        signInId: Number(draft.signInId),
        subject: typeof draft.subject === "string" ? draft.subject.trim() : "",
        body: typeof draft.body === "string" ? draft.body.trim() : "",
      }))
      .filter((draft) => draft.signInId > 0 && draft.subject && draft.body)
      .map((draft) => [draft.signInId, draft] as const)
  );

  const signInsToProcess = (
    requestedIds.length > 0
      ? await db
          .select()
          .from(signIns)
          .where(and(eq(signIns.eventId, Number(id)), inArray(signIns.id, requestedIds)))
      : signInId
      ? await db
          .select()
          .from(signIns)
          .where(and(eq(signIns.id, Number(signInId)), eq(signIns.eventId, Number(id))))
          .limit(1)
      : await db
          .select()
          .from(signIns)
          .where(and(eq(signIns.eventId, Number(id)), eq(signIns.followUpSent, false)))
  ).sort((a, b) => {
    const tierWeight = (tier: string | null) =>
      tier === "hot" ? 3 : tier === "warm" ? 2 : tier === "cold" ? 1 : 0;
    const scoreA =
      typeof (a.leadScore as LeadScore | null)?.overallScore === "number"
        ? ((a.leadScore as LeadScore | null)?.overallScore ?? 0)
        : 0;
    const scoreB =
      typeof (b.leadScore as LeadScore | null)?.overallScore === "number"
        ? ((b.leadScore as LeadScore | null)?.overallScore ?? 0)
        : 0;
    return tierWeight(b.leadTier) - tierWeight(a.leadTier) || scoreB - scoreA;
  });

  const relayConfigured = isEmailRelayConfigured();
  let activeMode = agent
    ? resolveEffectiveFollowUpMode(agent, relayConfigured)
    : "draft";
  const results = [];

  for (const signIn of signInsToProcess) {
    if (!signIn.email) {
      results.push({
        signInId: signIn.id,
        visitorName: signIn.fullName,
        deliveryMode: "draft",
        deliveryStatus: "skipped",
        error: "No email on file",
      });
      continue;
    }

    try {
      const storedDraft = parseStoredFollowUpDraft(signIn.followUpContent);
      const overrideDraft = draftOverrides.get(signIn.id);
      const result =
        overrideDraft
          ? { subject: overrideDraft.subject, body: overrideDraft.body, tokensUsed: 0 }
          : storedDraft && storedDraft.subject && storedDraft.body
            ? { subject: storedDraft.subject, body: storedDraft.body, tokensUsed: 0 }
          : await generateFollowUpEmail({
              agentName: agent?.fullName || "Your Agent",
              propertyAddress: event.propertyAddress,
              propertyType: event.propertyType,
              listPrice: event.listPrice,
              visitorName: signIn.fullName,
              visitorEmail: signIn.email,
              interestLevel: signIn.interestLevel,
              buyingTimeline: signIn.buyingTimeline,
              hasAgent: signIn.hasAgent ?? false,
              isPreApproved: signIn.isPreApproved,
              leadScore: signIn.leadScore as LeadScore | null,
              behavior: extractBehaviorSignals(signIn.leadScore as LeadScore | null),
            });

      let deliveryMode: DeliveryMode = "draft";
      const providerErrors: Array<{
        provider: Exclude<DeliveryMode, "draft">;
        message: string;
      }> = [];

      if (
        send &&
        activeMode === "google" &&
        agent?.gmailRefreshTokenEncrypted &&
        agent?.gmailSendAsEmail &&
        isGmailDirectSendAvailable()
      ) {
        try {
          await sendViaGmail({
            refreshTokenEncrypted: agent.gmailRefreshTokenEncrypted,
            senderEmail: agent.gmailSendAsEmail,
            to: signIn.email,
            subject: result.subject,
            text: result.body,
            replyTo: agent.email,
          });
          deliveryMode = "google";

          await db
            .update(users)
            .set({ gmailLastSendError: null })
            .where(eq(users.id, Number(session.user.id)));
        } catch (error) {
          const message = getErrorMessage(error, "Google mailbox send failed");
          providerErrors.push({ provider: "google", message });
          activeMode = "draft";

          if (error instanceof GmailIntegrationError) {
            if (error.code === "reauth_required") {
              await db
                .update(users)
                .set({
                  gmailRefreshTokenEncrypted: null,
                  gmailSendAsEmail: null,
                  gmailSendingEnabled: false,
                  gmailConnectedAt: null,
                  gmailLastSendError: error.message,
                  followUpEmailMode: "draft",
                })
                .where(eq(users.id, Number(session.user.id)));
            } else if (error.code === "invalid_sender") {
              await db
                .update(users)
                .set({
                  gmailSendingEnabled: false,
                  gmailLastSendError: error.message,
                  followUpEmailMode: "draft",
                })
                .where(eq(users.id, Number(session.user.id)));
            } else {
              await db
                .update(users)
                .set({
                  gmailLastSendError: error.message,
                })
                .where(eq(users.id, Number(session.user.id)));
            }
          } else {
            await db
              .update(users)
              .set({
                gmailLastSendError: message,
                followUpEmailMode: "draft",
              })
              .where(eq(users.id, Number(session.user.id)));
          }
        }
      } else if (
        send &&
        activeMode === "microsoft" &&
        agent?.microsoftRefreshTokenEncrypted &&
        agent?.microsoftSendAsEmail &&
        isMicrosoftDirectSendAvailable()
      ) {
        try {
          await sendViaMicrosoft({
            refreshTokenEncrypted: agent.microsoftRefreshTokenEncrypted,
            senderEmail: agent.microsoftSendAsEmail,
            to: signIn.email,
            subject: result.subject,
            text: result.body,
            replyTo: agent.email,
          });
          deliveryMode = "microsoft";

          await db
            .update(users)
            .set({ microsoftLastSendError: null })
            .where(eq(users.id, Number(session.user.id)));
        } catch (error) {
          const message = getErrorMessage(error, "Microsoft mailbox send failed");
          providerErrors.push({ provider: "microsoft", message });
          activeMode = "draft";

          if (error instanceof MicrosoftIntegrationError) {
            if (error.code === "reauth_required") {
              await db
                .update(users)
                .set({
                  microsoftRefreshTokenEncrypted: null,
                  microsoftSendAsEmail: null,
                  microsoftSendingEnabled: false,
                  microsoftConnectedAt: null,
                  microsoftLastSendError: error.message,
                  followUpEmailMode: "draft",
                })
                .where(eq(users.id, Number(session.user.id)));
            } else if (error.code === "invalid_sender") {
              await db
                .update(users)
                .set({
                  microsoftSendingEnabled: false,
                  microsoftLastSendError: error.message,
                  followUpEmailMode: "draft",
                })
                .where(eq(users.id, Number(session.user.id)));
            } else {
              await db
                .update(users)
                .set({
                  microsoftLastSendError: error.message,
                })
                .where(eq(users.id, Number(session.user.id)));
            }
          } else {
            await db
              .update(users)
              .set({
                microsoftLastSendError: message,
                followUpEmailMode: "draft",
              })
              .where(eq(users.id, Number(session.user.id)));
          }
        }
      } else if (
        send &&
        activeMode === "custom_domain" &&
        relayConfigured &&
        agent?.customSendingFromEmail &&
        agent?.customSendingDomainStatus === "verified"
      ) {
        try {
          await sendViaCustomDomainRelay({
            to: signIn.email,
            subject: result.subject,
            text: result.body,
            fromEmail: agent.customSendingFromEmail,
            fromName: agent.customSendingFromName,
            replyTo: agent.customSendingReplyToEmail || agent.email,
          });
          deliveryMode = "custom_domain";

          await db
            .update(users)
            .set({ customSendingLastError: null })
            .where(eq(users.id, Number(session.user.id)));
        } catch (error) {
          const message = getErrorMessage(error, "Custom domain relay failed");
          providerErrors.push({ provider: "custom_domain", message });
          activeMode = "draft";

          await db
            .update(users)
            .set({
              customSendingLastError: message,
              followUpEmailMode: "draft",
            })
            .where(eq(users.id, Number(session.user.id)));
        }
      }

      const followUpSent = send && deliveryMode !== "draft";

      await db
        .update(signIns)
        .set({
          followUpContent: serializeStoredFollowUpDraft({
            subject: result.subject,
            body: result.body,
            deliveryMode,
            providerErrors,
            generatedAt: new Date().toISOString(),
            generationSource: overrideDraft
              ? "manual"
              : storedDraft?.generationSource ?? "manual",
          }),
          followUpSent,
          followUpSentAt: followUpSent ? new Date() : null,
        })
        .where(eq(signIns.id, signIn.id));

      await markSignInPendingKevvSync(signIn.id).catch((error) => {
        console.error("[KevvSync] Failed to re-queue sign-in after follow-up update:", error);
      });

      results.push({
        signInId: signIn.id,
        visitorName: signIn.fullName,
        email: signIn.email,
        subject: result.subject,
        body: result.body,
        deliveryMode,
        deliveryStatus: followUpSent ? "sent" : "draft",
        providerErrors,
      });
    } catch (error) {
      console.error(`[FollowUp] Error for ${signIn.fullName}:`, error);
      results.push({
        signInId: signIn.id,
        visitorName: signIn.fullName,
        error: "Failed to generate",
      });
    }
  }

  return NextResponse.json({
    results,
    count: results.length,
    deliveryMode:
      results.length === 1
        ? (results[0].deliveryMode ?? "draft")
        : new Set(results.map((item) => item.deliveryMode).filter(Boolean)).size === 1
          ? (results.find((item) => item.deliveryMode)?.deliveryMode ?? "draft")
          : "mixed",
  });
}
