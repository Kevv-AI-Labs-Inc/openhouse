import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { siteConfig } from "@/lib/site";

type PublicTrustFooterProps = {
  compact?: boolean;
  showHomeLink?: boolean;
};

export function PublicTrustFooter({
  compact = false,
  showHomeLink = true,
}: PublicTrustFooterProps) {
  return (
    <footer className="border-t border-border/40 bg-background/92">
      <div
        className={`mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-sm text-muted-foreground md:px-8 ${
          compact ? "md:flex-row md:items-center md:justify-between" : "lg:flex-row lg:items-center lg:justify-between"
        }`}
      >
        <div className="space-y-2">
          <BrandLockup compact />
          <p className="max-w-xl text-xs leading-6">
            {siteConfig.legalName} is a real estate workflow platform for listing launches, visitor
            capture, seller reporting, and agent follow-up.
          </p>
        </div>

        <div className="flex flex-col gap-3 text-xs md:items-end">
          <div className="flex flex-wrap items-center gap-4">
            {showHomeLink ? (
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            ) : null}
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="inline-flex items-center gap-2 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {siteConfig.supportEmail}
            </a>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              Passwordless sign-in only. No local password box.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
