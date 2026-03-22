import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MagicLinkComplete } from "@/components/magic-link-complete";
import { sanitizeCallbackUrl } from "@/lib/auth-ux";
import { absoluteUrl } from "@/lib/site";

type MagicLinkPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Email Sign-In",
  description: "Complete your OpenHouse email sign-in link.",
  alternates: {
    canonical: absoluteUrl("/login/magic"),
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function MagicLinkPage({ searchParams }: MagicLinkPageProps) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);

  if (!token || typeof token !== "string") {
    redirect(
      `/login?error=Verification&provider=magic-link&callbackUrl=${encodeURIComponent(
        callbackUrl
      )}`
    );
  }

  return <MagicLinkComplete token={token} callbackUrl={callbackUrl} />;
}
