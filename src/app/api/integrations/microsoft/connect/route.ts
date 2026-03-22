import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site";
import {
  buildMicrosoftConnectUrl,
  createMicrosoftOAuthState,
  getMicrosoftRedirectUri,
  isMicrosoftDirectSendAvailable,
} from "@/lib/microsoft";

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

  if (!isMicrosoftDirectSendAvailable()) {
    const settingsUrl = new URL(returnTo, siteUrl);
    settingsUrl.searchParams.set("microsoft", "not-configured");
    return NextResponse.redirect(settingsUrl);
  }

  const originOverride = process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
  const redirectUri = getMicrosoftRedirectUri(originOverride);
  const state = createMicrosoftOAuthState({
    userId: Number(session.user.id),
    returnTo,
    redirectUri,
  });
  const url = buildMicrosoftConnectUrl({
    state,
    loginHint: session.user.email ?? null,
    redirectUri: originOverride,
  });

  return NextResponse.redirect(url);
}
