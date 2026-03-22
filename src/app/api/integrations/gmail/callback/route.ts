import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSiteUrl } from "@/lib/site";
import {
  encryptGmailRefreshToken,
  exchangeGmailCodeForTokens,
  fetchGoogleUserInfo,
  isGmailDirectSendAvailable,
  parseGmailOAuthState,
} from "@/lib/gmail";

function sanitizeReturnTo(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/settings";
  }

  return value;
}

function redirectWithStatus(returnTo: string, status: string) {
  const url = new URL(returnTo, `${getSiteUrl()}/`);
  url.searchParams.set("gmail", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const googleError = request.nextUrl.searchParams.get("error");

  let parsedState: { userId: number; returnTo?: string } | null = null;

  if (state) {
    try {
      parsedState = parseGmailOAuthState(state);
    } catch {
      parsedState = null;
    }
  }

  const returnTo = sanitizeReturnTo(parsedState?.returnTo);

  if (!isGmailDirectSendAvailable()) {
    return redirectWithStatus(returnTo, "not-configured");
  }

  if (googleError) {
    return redirectWithStatus(returnTo, googleError === "access_denied" ? "denied" : "error");
  }

  if (!parsedState?.userId || !code) {
    return redirectWithStatus(returnTo, "error");
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      gmailRefreshTokenEncrypted: users.gmailRefreshTokenEncrypted,
      followUpEmailMode: users.followUpEmailMode,
    })
    .from(users)
    .where(eq(users.id, parsedState.userId))
    .limit(1);

  if (!existingUser) {
    return redirectWithStatus(returnTo, "error");
  }

  try {
    const originOverride = process.env.NODE_ENV === "production" ? null : request.nextUrl.origin;
    const tokens = await exchangeGmailCodeForTokens(code, originOverride);
    const userInfo = await fetchGoogleUserInfo(tokens.access_token!);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptGmailRefreshToken(tokens.refresh_token)
      : existingUser.gmailRefreshTokenEncrypted;

    if (!refreshTokenEncrypted) {
      return redirectWithStatus(returnTo, "missing-refresh-token");
    }

    if (
      existingUser.email?.trim().toLowerCase() &&
      (userInfo.email ?? "").trim().toLowerCase() !== existingUser.email.trim().toLowerCase()
    ) {
      await db
        .update(users)
        .set({
          gmailLastSendError:
            "Google mailbox must match the email address on your OpenHouse account. Sign in with the same mailbox or reconnect with the matching Google account.",
        })
        .where(eq(users.id, existingUser.id));

      return redirectWithStatus(returnTo, "email-mismatch");
    }

    await db
      .update(users)
      .set({
        gmailRefreshTokenEncrypted: refreshTokenEncrypted,
        gmailSendAsEmail: userInfo.email ?? null,
        gmailSendingEnabled: true,
        gmailConnectedAt: new Date(),
        gmailLastSendError: null,
        followUpEmailMode:
          existingUser.followUpEmailMode === "draft"
            ? "google"
            : existingUser.followUpEmailMode,
      })
      .where(eq(users.id, existingUser.id));

    return redirectWithStatus(returnTo, "connected");
  } catch {
    return redirectWithStatus(returnTo, "error");
  }
}
