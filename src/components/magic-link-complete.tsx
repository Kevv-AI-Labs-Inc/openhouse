"use client";

import * as React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Button } from "@/components/ui/button";

type MagicLinkCompleteProps = {
  token: string;
  callbackUrl: string;
};

export function MagicLinkComplete({ token, callbackUrl }: MagicLinkCompleteProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"pending" | "failed">("pending");

  React.useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const response = await signIn("magic-link", {
        token,
        callbackUrl,
        redirect: false,
      });

      if (!active) {
        return;
      }

      if (response?.ok && response.url) {
        router.replace(response.url);
        return;
      }

      setStatus("failed");
      router.replace(
        `/login?error=Verification&provider=magic-link&callbackUrl=${encodeURIComponent(
          callbackUrl
        )}`
      );
    }

    void completeSignIn();

    return () => {
      active = false;
    };
  }, [callbackUrl, router, token]);

  return (
    <div className="brand-ambient relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-120px)] max-w-3xl items-center px-5 py-10">
        <div className="w-full rounded-[32px] border border-border/70 bg-card/90 p-8 text-center shadow-2xl shadow-emerald-900/5 backdrop-blur-xl">
          <div className="mb-6 flex justify-center">
            <BrandLockup />
          </div>

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-700">
            {status === "pending" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <MailCheck className="h-6 w-6" />
            )}
          </div>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Completing your sign-in</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            OpenHouse is verifying your one-time email link and creating the session. This page
            should redirect automatically.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/login">Back to sign-in</Link>
            </Button>
            <Button asChild>
              <Link href={callbackUrl}>Open dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
      <PublicTrustFooter />
    </div>
  );
}
