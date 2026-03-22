import type { User } from "@/lib/db/schema";
import { isPro } from "@/lib/plans";

export type FollowUpEmailMode = "draft" | "google" | "microsoft" | "custom_domain";

type FollowUpUser = Pick<
  User,
  | "subscriptionTier"
  | "followUpEmailMode"
  | "gmailRefreshTokenEncrypted"
  | "gmailSendAsEmail"
  | "gmailSendingEnabled"
  | "microsoftRefreshTokenEncrypted"
  | "microsoftSendAsEmail"
  | "microsoftSendingEnabled"
  | "customSendingDomain"
  | "customSendingDomainStatus"
  | "customSendingFromEmail"
  | "customSendingFromName"
  | "customSendingReplyToEmail"
>;

export function isGoogleMailboxConnected(user: Pick<
  User,
  "gmailRefreshTokenEncrypted" | "gmailSendAsEmail" | "gmailSendingEnabled"
>) {
  return Boolean(
    user.gmailRefreshTokenEncrypted && user.gmailSendAsEmail
  );
}

export function isMicrosoftMailboxConnected(user: Pick<
  User,
  "microsoftRefreshTokenEncrypted" | "microsoftSendAsEmail" | "microsoftSendingEnabled"
>) {
  return Boolean(
    user.microsoftRefreshTokenEncrypted && user.microsoftSendAsEmail
  );
}

export function isCustomDomainRelayReady(
  user: Pick<
    User,
    | "subscriptionTier"
    | "customSendingDomain"
    | "customSendingDomainStatus"
    | "customSendingFromEmail"
  >,
  relayConfigured: boolean
) {
  return Boolean(
    relayConfigured &&
      isPro(user.subscriptionTier) &&
      user.customSendingDomain &&
      user.customSendingFromEmail &&
      user.customSendingDomainStatus === "verified"
  );
}

export function resolveEffectiveFollowUpMode(
  user: FollowUpUser,
  relayConfigured: boolean
): FollowUpEmailMode {
  switch (user.followUpEmailMode) {
    case "google":
      return isGoogleMailboxConnected(user) ? "google" : "draft";
    case "microsoft":
      return isMicrosoftMailboxConnected(user) ? "microsoft" : "draft";
    case "custom_domain":
      return isCustomDomainRelayReady(user, relayConfigured) ? "custom_domain" : "draft";
    default:
      return "draft";
  }
}

export function getFollowUpModeLabel(mode: FollowUpEmailMode) {
  switch (mode) {
    case "google":
      return "Google mailbox";
    case "microsoft":
      return "Microsoft mailbox";
    case "custom_domain":
      return "Verified team domain";
    default:
      return "Draft only";
  }
}

export function formatSignInMethodLabel(provider?: string | null) {
  switch (provider) {
    case "google":
      return "Google OAuth";
    case "microsoft-entra-id":
      return "Microsoft OAuth";
    default:
      return "OAuth";
  }
}
