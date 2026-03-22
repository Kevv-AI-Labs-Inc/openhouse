import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { PublicTrustFooter } from "@/components/public-trust-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for OpenHouse authentication, listing workflows, and client follow-up.",
  alternates: {
    canonical: absoluteUrl("/privacy"),
  },
};

export default function PrivacyPage() {
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
              Privacy Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-sm leading-7 text-muted-foreground">
            <section>
              <h2 className="text-base font-semibold text-foreground">What OpenHouse stores</h2>
              <p className="mt-2">
                OpenHouse stores account profile data, event data, captured sign-ins, seller
                reporting artifacts, and configuration required to send follow-up from an
                agent-owned mailbox or verified team domain.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">How authentication works</h2>
              <p className="mt-2">
                OpenHouse uses passwordless sign-in through Google, Microsoft, or a one-time email
                link. We do not ask end users to create a local password. Account provisioning
                depends on the verified email address returned by the provider or entered for the
                sign-in link.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Mailbox permissions</h2>
              <p className="mt-2">
                Gmail or Microsoft mailbox sending permissions are requested only when an agent
                explicitly connects a mailbox inside Settings. These permissions are used to send
                client follow-up on the agent&apos;s behalf. If no mailbox or verified team domain is
                connected, OpenHouse saves the follow-up as a draft instead of sending it.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Use of captured visitor data</h2>
              <p className="mt-2">
                Listing agents use captured name, phone, email, and preference data to manage open
                house follow-up, listing inquiry workflows, and seller reporting. Public seller
                reports intentionally hide visitor phone numbers and email addresses.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">AI and listing imports</h2>
              <p className="mt-2">
                OpenHouse may process listing descriptions, MLS snapshots, uploaded flyers, and
                event context through configured AI services to generate summaries, Q&amp;A, and
                follow-up drafts. Agents are responsible for reviewing generated content before
                sending.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-foreground">Support</h2>
              <p className="mt-2">
                Questions about authentication, listing imports, or trust review can be sent to{" "}
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
