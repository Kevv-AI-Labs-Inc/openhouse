import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Support and trust contact details for OpenHouse.",
  alternates: {
    canonical: absoluteUrl("/contact"),
  },
};

export default function ContactPage() {
  return (
    <main className="brand-ambient min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-10 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <BrandLockup />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>

        <Card className="border-border/70 bg-card/88">
          <CardHeader>
            <CardTitle
              className="text-4xl tracking-tight"
              style={{ fontFamily: '"Canela", "Fraunces", "Times New Roman", serif' }}
            >
              Contact and trust information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-7 text-muted-foreground">
            <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
              <p className="text-base font-semibold text-foreground">{siteConfig.legalName}</p>
              <p className="mt-2">
                OpenHouse is a real estate workflow platform used for listing launches, reusable
                inquiry pages, seller reporting, and agent-operated follow-up.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-emerald-700" />
                  Support
                </p>
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="mt-3 block text-base font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {siteConfig.supportEmail}
                </a>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this address for account setup issues, OAuth verification questions, or site
                  trust review follow-up.
                </p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-background/70 p-5">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  Authentication model
                </p>
                <p className="mt-3">
                  OpenHouse uses passwordless sign-in through Google, Microsoft, or a one-time
                  email link. Agents connect mailbox permissions separately after login. The
                  platform does not ask visitors or agents for a local password.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-300/60 bg-amber-50 p-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950">
                <TriangleAlert className="h-4 w-4" />
                Browser safety warning or reputation false positive
              </p>
              <p className="mt-2 text-sm leading-7 text-amber-900/85">
                If your browser warns that this site looks suspicious, contact support with a
                screenshot, the exact URL, the browser name, and the approximate time. We use that
                information to follow up with Safe Browsing and SmartScreen review requests.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <PublicTrustFooter showHomeLink={false} />
    </main>
  );
}
