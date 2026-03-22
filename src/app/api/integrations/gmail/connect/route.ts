import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site";
import {
  buildGmailConnectUrl,
  createGmailOAuthState,
  isGmailDirectSendAvailable,
} from "@/lib/gmail";

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/settings";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const siteUrl = `${getSiteUrl()}/`;

  if (!session?.user?.id) {
    const loginUrl = new URL("/login", siteUrl);
    loginUrl.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(loginUrl);
  }

  if (!isGmailDirectSendAvailable()) {
    const settingsUrl = new URL(returnTo, siteUrl);
    settingsUrl.searchParams.set("gmail", "not-configured");
    return NextResponse.redirect(settingsUrl);
  }

  const originOverride = process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
  const state = createGmailOAuthState({
    userId: Number(session.user.id),
    returnTo,
  });
  const url = buildGmailConnectUrl({
    state,
    loginHint: session.user.email ?? null,
    originOverride,
  });

  return NextResponse.redirect(url);
}
