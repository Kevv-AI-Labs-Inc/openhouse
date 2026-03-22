import { brand } from "@/lib/brand";

const DEFAULT_SUPPORT_EMAIL = "support@example.com";
const DEFAULT_SITE_URL = "https://app.example.com";

export const siteConfig = {
  name: brand.name,
  legalName: brand.legalName,
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
  title: `${brand.name} | AI-Native Open House Platform`,
  description:
    "OpenHouse helps North American real estate teams import listings, publish reusable inquiry links, capture sign-ins, and turn every showing into seller-ready reporting.",
  xHandle: "@openhousehq",
  keywords: [
    "open house software",
    "real estate lead capture",
    "open house sign in app",
    "ai real estate lead scoring",
    "real estate crm workflow",
    "brokerage open house platform",
    "kiosk sign in for open house",
    "north america real estate technology",
  ],
  areaServed: ["US", "CA"],
};

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

const PRODUCTION_SITE_URL = DEFAULT_SITE_URL;

function normalizeUrl(url: string) {
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return trimTrailingSlash(withProtocol);
}

export function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    return normalizeUrl(envUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }

  return "http://localhost:3000";
}

export function absoluteUrl(pathname = "/") {
  return new URL(pathname, `${getSiteUrl()}/`).toString();
}

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getMailboxAuthOrigin(requestOrigin?: string | null) {
  const canonicalOrigin = getSiteUrl();
  if (process.env.NODE_ENV === "production") {
    return canonicalOrigin;
  }

  const canonicalHostname = (() => {
    try {
      return new URL(canonicalOrigin).hostname;
    } catch {
      return "";
    }
  })();
  const canonicalIsLocalhost = canonicalHostname ? isLocalhostHost(canonicalHostname) : false;

  if (!requestOrigin) {
    return canonicalOrigin;
  }

  try {
    const parsed = new URL(requestOrigin);

    if (isLocalhostHost(parsed.hostname)) {
      if (canonicalIsLocalhost) {
        return `http://${parsed.host}`;
      }

      return canonicalOrigin;
    }
  } catch {
    return canonicalOrigin;
  }

  return canonicalOrigin;
}

export function getSupportMailto(subject?: string) {
  const email = siteConfig.supportEmail;

  if (!subject) {
    return `mailto:${email}`;
  }

  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
