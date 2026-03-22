import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing the use of OpenHouse sign-in, seller reporting, and follow-up workflows.",
  alternates: {
    canonical: absoluteUrl("/terms"),
  },
};

export default function TermsPage() {
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

        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle
              className="text-4xl tracking-tight"
              style={{ fontFamily: '"Canela", "Fraunces", "Times New Roman", serif' }}
            >
              Terms of Service
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-sm leading-7 text-muted-foreground">
            <section>
              <h2 className="text-base font-semibold text-foreground">Authorized use</h2>
              <p className="mt-2">
                OpenHouse is intended for licensed real estate professionals, teams, and brokerages
                managing listing inquiries, open house traffic, seller reporting, and follow-up.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Customer communications</h2>
              <p className="mt-2">
                Agents are responsible for the legality, accuracy, and consent basis of any client
                communication sent through OpenHouse. If no approved sender identity is connected,
                OpenHouse stores follow-up as draft content only.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">External providers</h2>
              <p className="mt-2">
                Google, Microsoft, Stripe, AI services, listing data providers, and email delivery
                vendors may power parts of the product. Access to those services may depend on the
                user&apos;s own account standing, organization policy, or provider limits.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Data quality and review</h2>
              <p className="mt-2">
                Imported MLS data, uploaded flyer content, and AI-generated summaries should be
                reviewed by the agent before they are presented to clients, sellers, or buyer
                agents.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Availability</h2>
              <p className="mt-2">
                OpenHouse may change, suspend, or limit features to protect delivery quality,
                provider compliance, domain reputation, or platform security.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Support contact</h2>
              <p className="mt-2">
                Operational or security questions can be sent to{" "}
                <a
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  href={`mailto:${siteConfig.supportEmail}`}
                >
                  {siteConfig.supportEmail}
                </a>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
      <PublicTrustFooter showHomeLink={false} />
    </main>
  );
}
