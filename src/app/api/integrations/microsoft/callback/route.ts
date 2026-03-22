import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSiteUrl } from "@/lib/site";
import {
  encryptMicrosoftRefreshToken,
  exchangeMicrosoftCodeForTokens,
  fetchMicrosoftUserInfo,
  isMicrosoftDirectSendAvailable,
  parseMicrosoftOAuthState,
} from "@/lib/microsoft";

function sanitizeReturnTo(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/settings";
  }

  return value;
}

function redirectWithStatus(returnTo: string, status: string) {
  const url = new URL(returnTo, `${getSiteUrl()}/`);
  url.searchParams.set("microsoft", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const microsoftError = request.nextUrl.searchParams.get("error");

  let parsedState: { userId: number; returnTo?: string; redirectUri?: string } | null = null;

  if (state) {
    try {
      parsedState = parseMicrosoftOAuthState(state);
    } catch {
      parsedState = null;
    }
  }

  const returnTo = sanitizeReturnTo(parsedState?.returnTo);

  if (!isMicrosoftDirectSendAvailable()) {
    return redirectWithStatus(returnTo, "not-configured");
  }

  if (microsoftError) {
    return redirectWithStatus(
      returnTo,
      microsoftError === "access_denied" ? "denied" : "error"
    );
  }

  if (!parsedState?.userId || !code) {
    return redirectWithStatus(returnTo, "error");
  }

  const [existingUser] = await db
    .select({
      id: users.id,
      email: users.email,
      microsoftRefreshTokenEncrypted: users.microsoftRefreshTokenEncrypted,
      followUpEmailMode: users.followUpEmailMode,
    })
    .from(users)
    .where(eq(users.id, parsedState.userId))
    .limit(1);

  if (!existingUser) {
    return redirectWithStatus(returnTo, "error");
  }

  try {
    const tokens = await exchangeMicrosoftCodeForTokens(code, parsedState.redirectUri);
    const userInfo = await fetchMicrosoftUserInfo(tokens.access_token!);
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptMicrosoftRefreshToken(tokens.refresh_token)
      : existingUser.microsoftRefreshTokenEncrypted;

    if (!refreshTokenEncrypted) {
      return redirectWithStatus(returnTo, "missing-refresh-token");
    }

    if (
      existingUser.email?.trim().toLowerCase() &&
      userInfo.email.trim().toLowerCase() !== existingUser.email.trim().toLowerCase()
    ) {
      await db
        .update(users)
        .set({
          microsoftLastSendError:
            "Microsoft mailbox must match the email address on your OpenHouse account. Sign in with the same mailbox or reconnect with the matching Microsoft account.",
        })
        .where(eq(users.id, existingUser.id));

      return redirectWithStatus(returnTo, "email-mismatch");
    }

    await db
      .update(users)
      .set({
        microsoftRefreshTokenEncrypted: refreshTokenEncrypted,
        microsoftSendAsEmail: userInfo.email,
        microsoftSendingEnabled: true,
        microsoftConnectedAt: new Date(),
        microsoftLastSendError: null,
        followUpEmailMode:
          existingUser.followUpEmailMode === "draft"
            ? "microsoft"
            : existingUser.followUpEmailMode,
      })
      .where(eq(users.id, existingUser.id));

    return redirectWithStatus(returnTo, "connected");
  } catch {
    return redirectWithStatus(returnTo, "error");
  }
}
