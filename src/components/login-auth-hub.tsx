"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { LoginIssue, LoginProviderState } from "@/lib/auth-ux";

type LoginAuthHubProps = {
  callbackUrl: string;
  isNewWorkspaceFlow: boolean;
  issue: LoginIssue | null;
  magicLinkConfigured: boolean;
  providers: LoginProviderState[];
};

function GoogleGlyph() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftGlyph() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}

const providerMeta = {
  google: {
    label: "Google",
    subtitle: "Consumer Gmail or Google Workspace",
    icon: GoogleGlyph,
  },
  "microsoft-entra-id": {
    label: "Microsoft",
    subtitle: "Outlook or Microsoft 365 / Entra ID",
    icon: MicrosoftGlyph,
  },
} as const;

const issueToneStyles = {
  error: "border-rose-300/60 bg-rose-50 text-rose-950",
  warning: "border-amber-300/60 bg-amber-50 text-amber-950",
  info: "border-sky-300/60 bg-sky-50 text-sky-950",
} as const;

export function LoginAuthHub({
  callbackUrl,
  isNewWorkspaceFlow,
  issue,
  magicLinkConfigured,
  providers,
}: LoginAuthHubProps) {
  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null);
  const [magicLinkEmail, setMagicLinkEmail] = React.useState("");
  const [magicLinkPending, setMagicLinkPending] = React.useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = React.useState<string | null>(null);

  async function handleProviderSignIn(providerId: "google" | "microsoft-entra-id") {
    const provider = providerMap.get(providerId);

    if (!provider?.configured) {
      toast.error(`${providerMeta[providerId].label} sign-in is not configured yet.`);
      return;
    }

    try {
      setLoadingProvider(providerId);
      await signIn(providerId, { callbackUrl });
    } catch {
      toast.error(`${providerMeta[providerId].label} sign-in could not be started.`);
      setLoadingProvider(null);
    }
  }

  async function handleMagicLinkRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = magicLinkEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      toast.error("Enter the email address that should receive the sign-in link.");
      return;
    }

    if (!magicLinkConfigured) {
      toast.error("Email sign-in links are not configured yet.");
      return;
    }

    try {
      setMagicLinkPending(true);
      const response = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          callbackUrl,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "The sign-in link could not be sent.");
      }

      setMagicLinkSentTo(trimmedEmail);
      toast.success(payload?.message || "Check your inbox for a secure sign-in link.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The sign-in link could not be sent.");
    } finally {
      setMagicLinkPending(false);
    }
  }

  return (
    <div className="brand-ambient relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/12 blur-[110px]" />
        <div className="absolute right-[-10rem] top-[16rem] h-[24rem] w-[24rem] rounded-full bg-cyan-400/10 blur-[100px]" />
        <div className="absolute left-[-8rem] top-[26rem] h-[20rem] w-[20rem] rounded-full bg-teal-500/10 blur-[90px]" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-120px)] w-full max-w-7xl items-center gap-8 px-5 py-8 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:block">
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
            Secure identity handoff
          </Badge>
          <h1
            className="mt-6 max-w-2xl text-5xl font-semibold leading-tight tracking-tight font-display"
          >
            {isNewWorkspaceFlow
              ? "Start with the identity your team already trusts."
              : "A cleaner sign-in flow for agents, brokerages, and passwordless email access."}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            OpenHouse never asks agents for a password. Use Google, Microsoft, or a secure
            one-time email sign-in link. Gmail or Outlook sending permissions are connected
            separately later inside Settings.
          </p>

          <div className="mt-8 grid max-w-2xl gap-3">
            {[
              {
                title: "Identity stays with the provider",
                body: "OpenHouse stays passwordless. Identity comes from Google, Microsoft, or a one-time email link instead of a stored password database.",
                icon: LockKeyhole,
              },
              {
                title: "Google, Microsoft, or secure email link",
                body: "Agents can sign in with either ecosystem or request a one-time link, then connect a mailbox only if they want direct send later.",
                icon: Mail,
              },
              {
                title: "Draft-first safety when send setup is missing",
                body: "If mailbox delivery is not connected, follow-up remains a draft instead of silently relaying through a shared domain.",
                icon: ShieldCheck,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-border/70 bg-card/65 p-5 shadow-[0_24px_90px_rgba(15,41,64,0.06)] backdrop-blur"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Card className="w-full border-border/60 bg-card/88 shadow-2xl shadow-emerald-900/5 backdrop-blur-xl lg:max-w-xl lg:justify-self-end">
          <CardHeader className="space-y-3 border-b border-border/60 pb-5 text-center">
            <Link href="/" className="inline-flex items-center justify-center">
              <BrandLockup />
            </Link>

            <CardTitle
              className="text-3xl tracking-tight font-display"
            >
              {isNewWorkspaceFlow ? "Create your workspace" : "Sign in to OpenHouse"}
            </CardTitle>
            <CardDescription className="mx-auto max-w-md text-sm leading-6">
              {isNewWorkspaceFlow
                ? "Pick the provider you already use. We create the OpenHouse account automatically on first sign-in."
                : "Pick Google, Microsoft, or request a one-time email link. If a callback fails, the reason will show here instead of a generic access denied page."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            {issue ? (
              <div
                className={cn(
                  "rounded-3xl border px-4 py-4 text-left shadow-sm",
                  issueToneStyles[issue.tone]
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold">{issue.title}</p>
                      <p className="mt-1 text-sm leading-6 opacity-90">{issue.description}</p>
                    </div>
                    <div className="space-y-2">
                      {issue.checklist.map((item) => (
                        <div key={item} className="flex gap-2 text-sm leading-6">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 opacity-80" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-300/50 bg-emerald-50 px-4 py-4 text-left text-emerald-950">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-sm font-semibold">Passwords stay outside OpenHouse</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-900/85">
                      Authentication is delegated to Google, Microsoft, or a one-time email link.
                      No local password is stored inside OpenHouse.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {providers.map((provider) => {
                const meta = providerMeta[provider.id];
                const Icon = meta.icon;
                const disabled = !provider.configured || loadingProvider === provider.id;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => void handleProviderSignIn(provider.id)}
                    disabled={disabled}
                    className={cn(
                      "group rounded-3xl border border-border/70 bg-background/65 p-4 text-left shadow-[0_10px_40px_rgba(15,41,64,0.05)] transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-55",
                      provider.configured && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center text-base font-semibold text-foreground">
                          <Icon />
                          Continue with {meta.label}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
                      </div>
                      <div className="shrink-0">
                        {loadingProvider === provider.id ? (
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
                        ) : provider.configured ? (
                          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                            Live
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                            Not configured
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-muted-foreground/80">
              <span className="h-px flex-1 bg-border/70" />
              Passwordless fallback
              <span className="h-px flex-1 bg-border/70" />
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/65 p-4 shadow-[0_10px_40px_rgba(15,41,64,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Mail className="h-4 w-4 text-emerald-700" />
                    Email me a secure sign-in link
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Best when you do not want to use OAuth right now. The link expires quickly and
                    works once.
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                    magicLinkConfigured
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                  )}
                >
                  {magicLinkConfigured ? "Live" : "Not configured"}
                </span>
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleMagicLinkRequest}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="agent@brokerage.com"
                  value={magicLinkEmail}
                  onChange={(event) => setMagicLinkEmail(event.target.value)}
                  disabled={!magicLinkConfigured || magicLinkPending}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!magicLinkConfigured || magicLinkPending || !magicLinkEmail.trim()}
                >
                  {magicLinkPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending link
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Email me a sign-in link
                    </>
                  )}
                </Button>
              </form>

              {magicLinkSentTo ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                  If <span className="font-medium">{magicLinkSentTo}</span> is reachable, a one-time
                  OpenHouse link is on the way. Check spam or junk if it does not arrive in a minute.
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-border/70 bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-emerald-700" />
                Before you retry
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <p>Use the same Google or Microsoft account that owns the mailbox you plan to connect later.</p>
                <p>Magic links are system emails only. They help you sign in without creating a password.</p>
                <p>For Microsoft work accounts, tenant consent may be required before first use.</p>
                <p>If a browser safety banner appears, inspect your site reputation tooling. That warning is outside the OpenHouse auth callback itself.</p>
                <p>
                  Need help with a provider warning or callback failure? Contact{" "}
                  <a
                    href={`mailto:${siteConfig.supportEmail}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {siteConfig.supportEmail}
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/privacy">
                Privacy
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/terms">
                Terms
                <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link className="inline-flex items-center gap-1 hover:text-foreground" href="/">
                Return home
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <PublicTrustFooter />
    </div>
  );
}
