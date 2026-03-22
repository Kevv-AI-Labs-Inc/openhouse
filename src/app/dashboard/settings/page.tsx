"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Check,
  CreditCard,
  Globe,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { hasUnlimitedAiQueries } from "@/lib/plans";
import { formatSignInMethodLabel } from "@/lib/follow-up-email";

type FollowUpEmailMode = "draft" | "google" | "microsoft" | "custom_domain";

type BillingStatus = {
  tier: "free" | "pro";
  stripeConfigured: boolean;
  googleAuthConfigured: boolean;
  microsoftAuthConfigured: boolean;
  aiConfigured: boolean;
  emailRelayConfigured: boolean;
  gmailDirectSendAvailable: boolean;
  gmailConnected: boolean;
  gmailSendingEnabled: boolean;
  gmailSendAsEmail: string | null;
  gmailLastSendError: string | null;
  microsoftDirectSendAvailable: boolean;
  microsoftConnected: boolean;
  microsoftSendingEnabled: boolean;
  microsoftSendAsEmail: string | null;
  microsoftLastSendError: string | null;
  followUpEmailMode: FollowUpEmailMode;
  effectiveFollowUpEmailMode: FollowUpEmailMode;
  effectiveFollowUpEmailLabel: string;
  customSendingDomain: string | null;
  customSendingDomainStatus: "not_started" | "pending" | "verified" | "failed";
  customSendingFromEmail: string | null;
  customSendingFromName: string | null;
  customSendingReplyToEmail: string | null;
  customSendingLastError: string | null;
  listingImportConfigured: boolean;
  googlePlacesConfigured: boolean;
  eventsUsed: number;
  signInsUsed: number;
  proTrialLaunchesUsed: number;
  proTrialLaunchesRemaining: number;
  aiQueriesUsed: number;
  aiQueriesLimit: number;
  usageResetAt: string | null;
  limits: {
    maxEventsPerMonth: number | null;
    maxSignInsPerMonth: number | null;
  };
};

type SettingsAction =
  | "checkout"
  | "portal"
  | "gmail-connect"
  | "gmail-disconnect"
  | "microsoft-connect"
  | "microsoft-disconnect"
  | "mode-google"
  | "mode-microsoft"
  | "mode-custom"
  | "mode-draft"
  | "domain-save"
  | "domain-refresh"
  | "domain-clear"
  | null;

function renderUsageLimit(limit: number | null) {
  return limit === null ? "Unlimited" : limit.toLocaleString();
}

function domainStatusLabel(status: BillingStatus["customSendingDomainStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending DNS";
    case "failed":
      return "Not found";
    default:
      return "Not configured";
  }
}

function formatMailboxIssue(raw: string | null) {
  if (!raw) return null;

  if (/different client id/i.test(raw)) {
    return "This mailbox token belongs to a different Microsoft app configuration. Reconnect the mailbox after updating your Microsoft Entra client credentials.";
  }

  if (/email address on your OpenHouse account/i.test(raw)) {
    return raw;
  }

  if (/AADSTS70000/i.test(raw) || /invalid_grant/i.test(raw)) {
    return "Microsoft mailbox authorization is no longer valid. Reconnect the mailbox to refresh the token.";
  }

  if (/Google mailbox must match/i.test(raw)) {
    return raw;
  }

  return raw;
}

async function redirectToBilling(endpoint: "/api/billing/checkout" | "/api/billing/portal") {
  const res = await fetch(endpoint, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Billing action failed");
  }

  if (!data.url) {
    throw new Error("Billing URL was not returned");
  }

  window.location.href = data.url;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<SettingsAction>(null);
  const [customDomain, setCustomDomain] = useState("");
  const [customFromEmail, setCustomFromEmail] = useState("");
  const [customFromName, setCustomFromName] = useState("");
  const [customReplyTo, setCustomReplyTo] = useState("");

  const loadBillingStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/status");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load billing status");
      }

      setBillingStatus(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load billing status";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingResult = params.get("billing");
    const gmailResult = params.get("gmail");
    const microsoftResult = params.get("microsoft");

    if (billingResult === "success") {
      toast.success("Billing updated. Refreshing your subscription status.");
    }

    if (billingResult === "cancelled") {
      toast.message("Checkout cancelled.");
    }

    if (gmailResult === "connected") {
      toast.success("Google mailbox connected.");
    }

    if (gmailResult === "denied") {
      toast.message("Google mailbox connection was cancelled.");
    }

    if (gmailResult === "missing-refresh-token") {
      toast.error("Google did not return a refresh token. Try connecting it again.");
    }

    if (gmailResult === "not-configured") {
      toast.error("Google OAuth is not configured for mailbox sending.");
    }

    if (gmailResult === "email-mismatch") {
      toast.error("The connected Google mailbox must match your OpenHouse account email.");
    }

    if (gmailResult === "error") {
      toast.error("Unable to connect Google mailbox right now.");
    }

    if (microsoftResult === "connected") {
      toast.success("Microsoft mailbox connected.");
    }

    if (microsoftResult === "denied") {
      toast.message("Microsoft mailbox connection was cancelled.");
    }

    if (microsoftResult === "missing-refresh-token") {
      toast.error("Microsoft did not return a refresh token. Try connecting it again.");
    }

    if (microsoftResult === "not-configured") {
      toast.error("Microsoft OAuth is not configured for mailbox sending.");
    }

    if (microsoftResult === "email-mismatch") {
      toast.error("The connected Microsoft mailbox must match your OpenHouse account email.");
    }

    if (microsoftResult === "error") {
      toast.error("Unable to connect Microsoft mailbox right now.");
    }

    if (billingResult || gmailResult || microsoftResult) {
      params.delete("billing");
      params.delete("gmail");
      params.delete("microsoft");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    void loadBillingStatus();
  }, [loadBillingStatus]);

  useEffect(() => {
    if (!billingStatus) {
      return;
    }

    setCustomDomain(billingStatus.customSendingDomain || "");
    setCustomFromEmail(billingStatus.customSendingFromEmail || "");
    setCustomFromName(billingStatus.customSendingFromName || "");
    setCustomReplyTo(
      billingStatus.customSendingReplyToEmail || session?.user?.email || ""
    );
  }, [billingStatus, session?.user?.email]);

  const isPro = billingStatus?.tier === "pro";
  const stripeReady = billingStatus?.stripeConfigured ?? false;

  const currentSenderLabel = useMemo(() => {
    if (!billingStatus) {
      return "Checking...";
    }

    return billingStatus.effectiveFollowUpEmailLabel;
  }, [billingStatus]);

  const handleModeChange = useCallback(
    async (mode: FollowUpEmailMode) => {
      try {
        setAction(
          mode === "draft"
            ? "mode-draft"
            : mode === "google"
              ? "mode-google"
              : mode === "microsoft"
                ? "mode-microsoft"
                : "mode-custom"
        );

        const res = await fetch("/api/integrations/follow-up-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to update follow-up sender");
        }

        toast.success(
          mode === "draft"
            ? "Follow-ups now save as drafts only."
            : mode === "custom_domain"
              ? "Verified team domain is now active for client follow-ups."
              : `${mode === "google" ? "Google" : "Microsoft"} mailbox is now active for client follow-ups.`
        );
        await loadBillingStatus();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update follow-up sender";
        toast.error(message);
      } finally {
        setAction(null);
      }
    },
    [loadBillingStatus]
  );

  const handleDisconnect = useCallback(
    async (provider: "gmail" | "microsoft") => {
      try {
        setAction(provider === "gmail" ? "gmail-disconnect" : "microsoft-disconnect");
        const res = await fetch(`/api/integrations/${provider}/disconnect`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Failed to disconnect ${provider}`);
        }

        toast.success(
          provider === "gmail"
            ? "Google mailbox disconnected."
            : "Microsoft mailbox disconnected."
        );
        await loadBillingStatus();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Failed to disconnect ${provider}`;
        toast.error(message);
      } finally {
        setAction(null);
      }
    },
    [loadBillingStatus]
  );

  const handleSaveCustomDomain = useCallback(async () => {
    try {
      setAction("domain-save");
      const res = await fetch("/api/integrations/custom-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: customDomain,
          fromEmail: customFromEmail,
          fromName: customFromName,
          replyToEmail: customReplyTo,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save custom domain");
      }

      toast.success(
        data.status === "verified"
          ? "Custom sending domain is ready."
          : "Custom sending domain saved. Finish DNS verification in Resend, then refresh status."
      );
      await loadBillingStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save custom sending domain";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }, [customDomain, customFromEmail, customFromName, customReplyTo, loadBillingStatus]);

  const handleRefreshCustomDomain = useCallback(async () => {
    try {
      setAction("domain-refresh");
      const res = await fetch("/api/integrations/custom-domain/refresh", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh domain status");
      }

      toast.success(
        data.status === "verified"
          ? "Custom domain verified."
          : "Checked Resend again. Domain is still not ready."
      );
      await loadBillingStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh domain status";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }, [loadBillingStatus]);

  const handleClearCustomDomain = useCallback(async () => {
    try {
      setAction("domain-clear");
      const res = await fetch("/api/integrations/custom-domain", {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to clear custom domain");
      }

      toast.success("Custom sending domain removed.");
      await loadBillingStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear custom sending domain";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }, [loadBillingStatus]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage account access, delivery identities, and subscription settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm">{session?.user?.name || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{session?.user?.email || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sign-in method</span>
            <span className="text-sm">
              {formatSignInMethodLabel(session?.user?.authProvider)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading || !billingStatus ? (
            <p className="text-sm text-muted-foreground">Checking deployment configuration...</p>
          ) : (
            <>
              {[
                {
                  label: "Google Auth",
                  configured: billingStatus.googleAuthConfigured,
                  detail: "Required for Google sign-in and Google mailbox connections",
                },
                {
                  label: "Microsoft Auth",
                  configured: billingStatus.microsoftAuthConfigured,
                  detail: "Required for Microsoft sign-in and Microsoft mailbox connections",
                },
                {
                  label: "Stripe Billing",
                  configured: billingStatus.stripeConfigured,
                  detail: "Required for self-serve Pro upgrades and renewals",
                },
                {
                  label: "Azure OpenAI",
                  configured: billingStatus.aiConfigured,
                  detail: "Required for AI scoring, follow-up generation, and property Q&A",
                },
                {
                  label: "Email Relay",
                  configured: billingStatus.emailRelayConfigured,
                  detail: "Required only for Pro custom sending domains",
                },
                {
                  label: "Listing Data Service",
                  configured: billingStatus.listingImportConfigured,
                  detail: "Required for Import by MLS # and Import by Address event backfill",
                },
                {
                  label: "Google Places",
                  configured: billingStatus.googlePlacesConfigured,
                  detail: "Optional but recommended for realtime address suggestions before provider matching",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge
                    className={
                      item.configured
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                    }
                  >
                    {item.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Follow-up Delivery</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Client follow-ups only send from an agent-owned mailbox or a verified Pro team
                domain. OpenHouse no longer falls back to a shared platform sender.
              </p>
            </div>
            <Badge
              className={
                billingStatus?.effectiveFollowUpEmailMode === "draft"
                  ? "border-border/70 bg-card/60 text-muted-foreground"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              }
            >
              {currentSenderLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !billingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading delivery settings...
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                If the selected sender is unavailable at send time, OpenHouse saves a draft and
                records the error instead of relaying through a shared platform sender.
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-emerald-600" />
                        <p className="text-sm font-semibold">Google mailbox</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {billingStatus.gmailConnected
                          ? `Connected as ${billingStatus.gmailSendAsEmail}`
                          : "Connect a Gmail or Google Workspace inbox to send follow-ups directly from that mailbox."}
                      </p>
                    </div>
                    <Badge
                      className={
                        billingStatus.effectiveFollowUpEmailMode === "google"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : billingStatus.gmailConnected
                            ? "border-border/70 bg-card/60 text-muted-foreground"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                      }
                    >
                      {billingStatus.effectiveFollowUpEmailMode === "google"
                        ? "Active"
                        : billingStatus.gmailConnected
                          ? "Connected"
                          : "Not connected"}
                    </Badge>
                  </div>

                  {billingStatus.gmailLastSendError && (
                    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                      <p className="font-medium">Last Google send issue</p>
                      <p className="mt-1 text-amber-800">
                        {formatMailboxIssue(billingStatus.gmailLastSendError)}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!billingStatus.gmailConnected ? (
                      <Button
                        disabled={!billingStatus.gmailDirectSendAvailable || action === "gmail-connect"}
                        onClick={() => {
                          setAction("gmail-connect");
                          window.location.href =
                            "/api/integrations/gmail/connect?returnTo=/dashboard/settings";
                        }}
                      >
                        {action === "gmail-connect" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-4 w-4" />
                        )}
                        Connect Google
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant={
                            billingStatus.followUpEmailMode === "google" ? "outline" : "default"
                          }
                          disabled={action === "mode-google"}
                          onClick={() => {
                            void handleModeChange("google");
                          }}
                        >
                          {action === "mode-google" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="mr-2 h-4 w-4" />
                          )}
                          {billingStatus.followUpEmailMode === "google"
                            ? "Google selected"
                            : "Use Google"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={action === "gmail-disconnect"}
                          onClick={() => {
                            void handleDisconnect("gmail");
                          }}
                        >
                          {action === "gmail-disconnect" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Mail className="mr-2 h-4 w-4" />
                          )}
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>

                  {!billingStatus.gmailDirectSendAvailable && (
                    <p className="mt-4 text-sm text-amber-700">
                      Add Google OAuth credentials before enabling Google mailbox connections.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-cyan-600" />
                        <p className="text-sm font-semibold">Microsoft mailbox</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {billingStatus.microsoftConnected
                          ? `Connected as ${billingStatus.microsoftSendAsEmail}`
                          : "Connect Outlook or Microsoft 365 to send follow-ups directly from that mailbox."}
                      </p>
                    </div>
                    <Badge
                      className={
                        billingStatus.effectiveFollowUpEmailMode === "microsoft"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : billingStatus.microsoftConnected
                            ? "border-border/70 bg-card/60 text-muted-foreground"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-800"
                      }
                    >
                      {billingStatus.effectiveFollowUpEmailMode === "microsoft"
                        ? "Active"
                        : billingStatus.microsoftConnected
                          ? "Connected"
                          : "Not connected"}
                    </Badge>
                  </div>

                  {billingStatus.microsoftLastSendError && (
                    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                      <p className="font-medium">Last Microsoft send issue</p>
                      <p className="mt-1 text-amber-800">
                        {formatMailboxIssue(billingStatus.microsoftLastSendError)}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!billingStatus.microsoftConnected ? (
                      <Button
                        disabled={
                          !billingStatus.microsoftDirectSendAvailable ||
                          action === "microsoft-connect"
                        }
                        onClick={() => {
                          setAction("microsoft-connect");
                          window.location.href =
                            "/api/integrations/microsoft/connect?returnTo=/dashboard/settings";
                        }}
                      >
                        {action === "microsoft-connect" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Connect Microsoft
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant={
                            billingStatus.followUpEmailMode === "microsoft"
                              ? "outline"
                              : "default"
                          }
                          disabled={action === "mode-microsoft"}
                          onClick={() => {
                            void handleModeChange("microsoft");
                          }}
                        >
                          {action === "mode-microsoft" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="mr-2 h-4 w-4" />
                          )}
                          {billingStatus.followUpEmailMode === "microsoft"
                            ? "Microsoft selected"
                            : "Use Microsoft"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={action === "microsoft-disconnect"}
                          onClick={() => {
                            void handleDisconnect("microsoft");
                          }}
                        >
                          {action === "microsoft-disconnect" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="mr-2 h-4 w-4" />
                          )}
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>

                  {!billingStatus.microsoftDirectSendAvailable && (
                    <p className="mt-4 text-sm text-amber-700">
                      Add Microsoft Entra credentials before enabling Microsoft mailbox connections.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-background/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-orange-600" />
                      <p className="text-sm font-semibold">Pro team domain relay</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Pro accounts can send through a verified brokerage or team subdomain such as
                      `mail.brand.com`. Verification happens in your Resend account.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        billingStatus.customSendingDomainStatus === "verified"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border-border/70 bg-card/60 text-muted-foreground"
                      }
                    >
                      {domainStatusLabel(billingStatus.customSendingDomainStatus)}
                    </Badge>
                    <Badge
                      className={
                        isPro
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                          : "border-border/70 bg-card/60 text-muted-foreground"
                      }
                    >
                      {isPro ? "Pro" : "Upgrade required"}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="custom-domain">Sending domain</Label>
                    <Input
                      id="custom-domain"
                      placeholder="mail.brand.com"
                      value={customDomain}
                      onChange={(event) => setCustomDomain(event.target.value)}
                      disabled={!isPro}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-from-email">From email</Label>
                    <Input
                      id="custom-from-email"
                      placeholder="hello@mail.brand.com"
                      value={customFromEmail}
                      onChange={(event) => setCustomFromEmail(event.target.value)}
                      disabled={!isPro}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-from-name">From name</Label>
                    <Input
                      id="custom-from-name"
                      placeholder="The Wright Team"
                      value={customFromName}
                      onChange={(event) => setCustomFromName(event.target.value)}
                      disabled={!isPro}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custom-reply-to">Reply-to email</Label>
                    <Input
                      id="custom-reply-to"
                      placeholder={session?.user?.email || "agent@brand.com"}
                      value={customReplyTo}
                      onChange={(event) => setCustomReplyTo(event.target.value)}
                      disabled={!isPro}
                    />
                  </div>
                </div>

                {billingStatus.customSendingLastError && (
                  <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
                    <p className="font-medium">Domain status</p>
                    <p className="mt-1 text-amber-800">{billingStatus.customSendingLastError}</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={!isPro || action === "domain-save"}
                    onClick={() => {
                      void handleSaveCustomDomain();
                    }}
                  >
                    {action === "domain-save" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    Save domain config
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!isPro || action === "domain-refresh"}
                    onClick={() => {
                      void handleRefreshCustomDomain();
                    }}
                  >
                    {action === "domain-refresh" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    Refresh verification
                  </Button>
                  <Button
                    variant={
                      billingStatus.followUpEmailMode === "custom_domain" ? "outline" : "default"
                    }
                    disabled={
                      !isPro ||
                      billingStatus.customSendingDomainStatus !== "verified" ||
                      action === "mode-custom"
                    }
                    onClick={() => {
                      void handleModeChange("custom_domain");
                    }}
                  >
                    {action === "mode-custom" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    {billingStatus.followUpEmailMode === "custom_domain"
                      ? "Team domain selected"
                      : "Use team domain"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!isPro || action === "domain-clear"}
                    onClick={() => {
                      void handleClearCustomDomain();
                    }}
                  >
                    {action === "domain-clear" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="mr-2 h-4 w-4" />
                    )}
                    Clear config
                  </Button>
                </div>

                {!billingStatus.emailRelayConfigured && (
                  <p className="mt-4 text-sm text-amber-700">
                    Configure Resend before using a Pro team domain relay.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
                <div>
                  <p className="text-sm font-medium">Draft only</p>
                  <p className="text-sm text-muted-foreground">
                    Use this when you want OpenHouse to generate follow-up content but never send
                    on your behalf.
                  </p>
                </div>
                <Button
                  variant={
                    billingStatus.followUpEmailMode === "draft" ? "outline" : "default"
                  }
                  disabled={action === "mode-draft"}
                  onClick={() => {
                    void handleModeChange("draft");
                  }}
                >
                  {action === "mode-draft" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {billingStatus.followUpEmailMode === "draft"
                    ? "Draft only selected"
                    : "Use draft only"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className={isPro ? "border-emerald-500/30" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Subscription</CardTitle>
            <Badge
              className={
                isPro
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-border/70 bg-card/60 text-muted-foreground"
              }
            >
              {isPro ? "Pro" : "Free"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing status...
            </div>
          ) : !billingStatus ? (
            <p className="text-sm text-muted-foreground">Billing status is unavailable right now.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Listing launches
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {billingStatus.eventsUsed}
                    {billingStatus.limits.maxEventsPerMonth !== null && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / {renderUsageLimit(billingStatus.limits.maxEventsPerMonth)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingStatus.limits.maxEventsPerMonth === null
                      ? "Unlimited on your current plan"
                      : `${renderUsageLimit(billingStatus.limits.maxEventsPerMonth)} included monthly`}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Pro launch trial
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {billingStatus.proTrialLaunchesUsed} / 3
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingStatus.tier === "pro"
                      ? "All future launches already run with Pro features."
                      : billingStatus.proTrialLaunchesRemaining > 0
                        ? `${billingStatus.proTrialLaunchesRemaining} published launch${billingStatus.proTrialLaunchesRemaining === 1 ? "" : "es"} still include Pro features`
                        : "Your included Pro trial launches have been used"}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Sign-ins
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {billingStatus.signInsUsed}
                    {billingStatus.limits.maxSignInsPerMonth !== null && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / {renderUsageLimit(billingStatus.limits.maxSignInsPerMonth)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingStatus.limits.maxSignInsPerMonth === null
                      ? "Unlimited capture volume"
                      : `${renderUsageLimit(billingStatus.limits.maxSignInsPerMonth)} included monthly`}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    AI Q&A usage
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {billingStatus.aiQueriesUsed}
                    {!hasUnlimitedAiQueries(billingStatus.aiQueriesLimit) &&
                      billingStatus.aiQueriesLimit > 0 && (
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          / {billingStatus.aiQueriesLimit}
                        </span>
                      )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hasUnlimitedAiQueries(billingStatus.aiQueriesLimit)
                      ? "Unlimited on Pro"
                      : billingStatus.aiQueriesLimit > 0
                        ? `${billingStatus.aiQueriesLimit.toLocaleString()} included monthly`
                        : "AI Q&A is available on Pro"}
                  </p>
                </div>
              </div>

              {billingStatus.usageResetAt && (
                <p className="text-sm text-muted-foreground">
                  Usage resets on {new Date(billingStatus.usageResetAt).toLocaleDateString()}.
                </p>
              )}

              {isPro ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> Unlimited listing launches
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> AI lead scoring
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> Unlimited AI Q&A
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> Google or Microsoft mailbox send
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> Verified team sending domains
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Check className="h-3 w-3 text-emerald-500" /> Share kit + seller report
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!stripeReady || action === "portal"}
                    onClick={async () => {
                      try {
                        setAction("portal");
                        await redirectToBilling("/api/billing/portal");
                      } catch (error) {
                        const message =
                          error instanceof Error ? error.message : "Unable to open billing portal";
                        toast.error(message);
                        setAction(null);
                      }
                    }}
                  >
                    {action === "portal" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    Manage Billing
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Free keeps launches and monthly captures generous, and your first 3 published
                    launches automatically run with Pro features so you can build the habit before
                    upgrading. After those trial launches, Pro keeps AI qualification, buyer Q&A,
                    direct mailbox sending, and verified team domains available on every listing.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> First 3 published launches include Pro
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> AI lead scoring + gated Q&A
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> AI follow-up drafts and mailbox send
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> Seller attribution and share kit
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The $29 upgrade keeps those Pro features active after launch 3. It is priced
                    around the automation layer, reusable inquiry attribution, and sender identity
                    control, not the basic form itself.
                  </p>
                  <Button
                    className="w-full border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                    disabled={!stripeReady || action === "checkout"}
                    onClick={async () => {
                      try {
                        setAction("checkout");
                        await redirectToBilling("/api/billing/checkout");
                      } catch (error) {
                        const message =
                          error instanceof Error ? error.message : "Unable to start checkout";
                        toast.error(message);
                        setAction(null);
                      }
                    }}
                  >
                    {action === "checkout" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Star className="mr-2 h-4 w-4" />
                    )}
                    Upgrade to Pro — $29/mo
                  </Button>
                  {!stripeReady && (
                    <p className="text-sm text-amber-700">
                      Stripe is not configured in this environment yet.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
