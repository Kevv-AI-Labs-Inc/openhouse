import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBillingSnapshot } from "@/lib/billing";
import { hasAiConfiguration } from "@/lib/ai/openai";
import { isEmailRelayConfigured } from "@/lib/email";
import { isGmailDirectSendAvailable } from "@/lib/gmail";
import { isMicrosoftDirectSendAvailable } from "@/lib/microsoft";
import { isListingImportConfigured } from "@/lib/listing-import";
import { isGooglePlacesConfigured } from "@/lib/google-places";
import { getFollowUpModeLabel, resolveEffectiveFollowUpMode } from "@/lib/follow-up-email";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getBillingSnapshot(Number(session.user.id));

  if (!snapshot) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    tier: snapshot.tier,
    stripeConfigured: snapshot.stripeConfigured,
    aiConfigured: hasAiConfiguration(),
    emailRelayConfigured: isEmailRelayConfigured(),
    gmailDirectSendAvailable: isGmailDirectSendAvailable(),
    gmailConnected: Boolean(
      snapshot.user.gmailRefreshTokenEncrypted && snapshot.user.gmailSendAsEmail
    ),
    gmailSendingEnabled: snapshot.user.gmailSendingEnabled,
    gmailSendAsEmail: snapshot.user.gmailSendAsEmail,
    gmailLastSendError: snapshot.user.gmailLastSendError,
    microsoftDirectSendAvailable: isMicrosoftDirectSendAvailable(),
    microsoftConnected: Boolean(
      snapshot.user.microsoftRefreshTokenEncrypted && snapshot.user.microsoftSendAsEmail
    ),
    microsoftSendingEnabled: snapshot.user.microsoftSendingEnabled,
    microsoftSendAsEmail: snapshot.user.microsoftSendAsEmail,
    microsoftLastSendError: snapshot.user.microsoftLastSendError,
    followUpEmailMode: snapshot.user.followUpEmailMode,
    effectiveFollowUpEmailMode: resolveEffectiveFollowUpMode(
      snapshot.user,
      isEmailRelayConfigured()
    ),
    effectiveFollowUpEmailLabel: getFollowUpModeLabel(
      resolveEffectiveFollowUpMode(snapshot.user, isEmailRelayConfigured())
    ),
    customSendingDomain: snapshot.user.customSendingDomain,
    customSendingDomainStatus: snapshot.user.customSendingDomainStatus,
    customSendingFromEmail: snapshot.user.customSendingFromEmail,
    customSendingFromName: snapshot.user.customSendingFromName,
    customSendingReplyToEmail: snapshot.user.customSendingReplyToEmail,
    customSendingLastError: snapshot.user.customSendingLastError,
    listingImportConfigured: isListingImportConfigured(),
    googlePlacesConfigured: isGooglePlacesConfigured(),
    googleAuthConfigured: Boolean(
      (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID) &&
        (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET)
    ),
    microsoftAuthConfigured: Boolean(
      (process.env.AUTH_MICROSOFT_ENTRA_ID_ID || process.env.MICROSOFT_CLIENT_ID) &&
        (process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || process.env.MICROSOFT_CLIENT_SECRET)
    ),
    eventsUsed: snapshot.eventsUsed,
    signInsUsed: snapshot.signInsUsed,
    proTrialLaunchesUsed: snapshot.proTrialLaunchesUsed,
    proTrialLaunchesRemaining: snapshot.proTrialLaunchesRemaining,
    limits: snapshot.limits,
    aiQueriesUsed: snapshot.user.aiQueriesUsed,
    aiQueriesLimit: snapshot.user.aiQueriesLimit,
    usageResetAt: snapshot.user.usageResetAt,
    stripeCustomerId: snapshot.user.stripeCustomerId,
    stripeSubscriptionId: snapshot.user.stripeSubscriptionId,
  });
}
