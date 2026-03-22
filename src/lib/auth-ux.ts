import { formatAuthProviderLabel, type AuthProviderId } from "@/lib/auth-provider-config";

export type LoginIssueTone = "error" | "warning" | "info";

export type LoginIssue = {
  tone: LoginIssueTone;
  title: string;
  description: string;
  checklist: string[];
};

export type LoginProviderState = {
  id: Exclude<AuthProviderId, "magic-link">;
  label: string;
  configured: boolean;
};

export function sanitizeCallbackUrl(candidate?: string | string[] | null) {
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;

  if (!raw || typeof raw !== "string") {
    return "/dashboard";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }

  return "/dashboard";
}

export function resolveLoginIssue(
  error?: string | string[] | null,
  provider?: string | string[] | null
): LoginIssue | null {
  const code = Array.isArray(error) ? error[0] : error;
  const providerCode = Array.isArray(provider) ? provider[0] : provider;
  const providerLabel = formatAuthProviderLabel(providerCode);

  if (!code) {
    return null;
  }

  switch (code) {
    case "AccessDenied":
    case "denied":
      return {
        tone: "warning",
        title: `${providerLabel} authorization was not completed`,
        description:
          "The provider did not finish the sign-in request. This usually means consent was cancelled, the app is still in testing, or the organization blocked the request.",
        checklist: [
          "Retry the same provider once in a fresh browser tab.",
          "If this is a Google testing app, confirm your email is listed as a test user.",
          "If this is a Microsoft work account, ask the tenant admin to allow the app or grant consent.",
        ],
      };
    case "missing-email":
      return {
        tone: "warning",
        title: `${providerLabel} did not return a usable email`,
        description:
          "OpenHouse provisions accounts by verified email address. The provider completed OAuth, but the callback did not include a stable email we can attach to a workspace.",
        checklist: [
          "Use an account with a real mailbox, not an alias-only identity.",
          "For Microsoft, prefer the account's primary work mailbox instead of an external guest identity.",
          "If the problem repeats, reconnect with another provider and compare the result.",
        ],
      };
    case "account-sync-failed":
      return {
        tone: "error",
        title: "We could not finish account provisioning",
        description:
          "Authentication succeeded, but OpenHouse could not create or update the local workspace record. This is usually a database or callback configuration issue on our side.",
        checklist: [
          "Retry once to rule out a transient callback failure.",
          "If it repeats, review the deployment logs for the sign-in callback.",
          "Do not keep retrying different providers until the callback error is fixed.",
        ],
      };
    case "OAuthSignin":
    case "OAuthCallback":
    case "Callback":
    case "CallbackRouteError":
      return {
        tone: "error",
        title: `${providerLabel} could not complete the callback`,
        description:
          "The provider redirect returned, but the OAuth callback failed before a session could be created.",
        checklist: [
          "Verify the exact redirect URI in Google Cloud or Microsoft Entra.",
          "Confirm the provider client ID and secret are set in production.",
          "Check deployment logs for the callback route around the failed timestamp.",
        ],
      };
    case "Configuration":
      return {
        tone: "error",
        title: "Authentication is not configured correctly",
        description:
          "OpenHouse received a request for a provider that is missing credentials, redirect URIs, or environment variables.",
        checklist: [
          "Confirm the provider is configured in Railway for this environment.",
          "Make sure the production redirect URIs exactly match the current domain.",
          "Disable any provider button that is not fully configured.",
        ],
      };
    case "Verification":
    case "CredentialsSignin":
      return {
        tone: "warning",
        title: "This sign-in link is no longer valid",
        description:
          "A one-time verification or callback token has expired or has already been used.",
        checklist: [
          "Start sign-in again from the OpenHouse login page.",
          "Avoid reopening an old callback link from browser history.",
        ],
      };
    case "Default":
    default:
      return {
        tone: "error",
        title: "Sign-in did not complete",
        description:
          "OpenHouse received an unexpected authentication error. The request was stopped before a session was created.",
        checklist: [
          "Retry the same provider once.",
          "If the issue only happens in one browser, clear the site cookies and try again.",
          "If it repeats, inspect the auth callback logs with the exact time of the failure.",
        ],
      };
  }
}
