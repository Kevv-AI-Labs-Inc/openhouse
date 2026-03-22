import { createHash, randomBytes } from "crypto";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const MAGIC_LINK_TTL_MINUTES = 15;
export const MAGIC_LINK_TTL_MS = MAGIC_LINK_TTL_MINUTES * 60 * 1000;

export function normalizeMagicLinkEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createMagicLinkToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashMagicLinkToken(token),
  };
}

export function hashMagicLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getMagicLinkExpiry() {
  return new Date(Date.now() + MAGIC_LINK_TTL_MS);
}

export function buildMagicLinkUrl(token: string, redirectPath: string) {
  const url = new URL(absoluteUrl("/login/magic"));
  url.searchParams.set("token", token);

  if (redirectPath && redirectPath !== "/dashboard") {
    url.searchParams.set("callbackUrl", redirectPath);
  }

  return url.toString();
}

export function buildMagicLinkEmailText(signInUrl: string) {
  return [
    "Use this secure OpenHouse sign-in link to continue.",
    "",
    signInUrl,
    "",
    `This link expires in ${MAGIC_LINK_TTL_MINUTES} minutes and can only be used once.`,
    "If you did not request this email, you can safely ignore it.",
    "",
    `Need help? Contact ${siteConfig.supportEmail}.`,
  ].join("\n");
}
