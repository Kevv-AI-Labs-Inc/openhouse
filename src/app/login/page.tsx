import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginAuthHub } from "@/components/login-auth-hub";
import { resolveLoginIssue, sanitizeCallbackUrl } from "@/lib/auth-ux";
import { isSystemEmailConfigured } from "@/lib/email";
import {
  formatAuthProviderLabel,
  getEnabledAuthProviders,
  isGoogleAuthConfigured,
  isMicrosoftAuthConfigured,
} from "@/lib/auth-provider-config";
import { absoluteUrl } from "@/lib/site";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Secure Sign In",
  description:
    "Sign in to OpenHouse with Google, Microsoft, or a one-time email link. Authentication never depends on a local password form.",
  alternates: {
    canonical: absoluteUrl("/login"),
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);
  const session = await auth();

  if (session?.user?.id) {
    redirect(callbackUrl || "/dashboard");
  }

  const issue = resolveLoginIssue(params.error, params.provider);
  const enabledProviders = new Set(getEnabledAuthProviders());

  const providers = [
    {
      id: "google" as const,
      label: formatAuthProviderLabel("google"),
      configured: isGoogleAuthConfigured() && enabledProviders.has("google"),
    },
    {
      id: "microsoft-entra-id" as const,
      label: formatAuthProviderLabel("microsoft-entra-id"),
      configured:
        isMicrosoftAuthConfigured() && enabledProviders.has("microsoft-entra-id"),
    },
  ];

  return (
    <LoginAuthHub
      callbackUrl={callbackUrl}
      isNewWorkspaceFlow={params.mode === "new"}
      issue={issue}
      magicLinkConfigured={isSystemEmailConfigured()}
      providers={providers}
    />
  );
}
