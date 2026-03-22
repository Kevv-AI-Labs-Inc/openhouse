import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isEmailRelayConfigured } from "@/lib/email";
import {
  type FollowUpEmailMode,
  isCustomDomainRelayReady,
  isGoogleMailboxConnected,
  isMicrosoftMailboxConnected,
} from "@/lib/follow-up-email";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const mode = body?.mode as FollowUpEmailMode | undefined;

  if (!mode || !["draft", "google", "microsoft", "custom_domain"].includes(mode)) {
    return NextResponse.json({ error: "Invalid follow-up mode" }, { status: 400 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      id: users.id,
      subscriptionTier: users.subscriptionTier,
      gmailRefreshTokenEncrypted: users.gmailRefreshTokenEncrypted,
      gmailSendAsEmail: users.gmailSendAsEmail,
      gmailSendingEnabled: users.gmailSendingEnabled,
      microsoftRefreshTokenEncrypted: users.microsoftRefreshTokenEncrypted,
      microsoftSendAsEmail: users.microsoftSendAsEmail,
      microsoftSendingEnabled: users.microsoftSendingEnabled,
      customSendingDomain: users.customSendingDomain,
      customSendingDomainStatus: users.customSendingDomainStatus,
      customSendingFromEmail: users.customSendingFromEmail,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (mode === "google" && !isGoogleMailboxConnected(user)) {
    return NextResponse.json({ error: "Connect Google mail before enabling it" }, { status: 400 });
  }

  if (mode === "microsoft" && !isMicrosoftMailboxConnected(user)) {
    return NextResponse.json({ error: "Connect Microsoft mail before enabling it" }, { status: 400 });
  }

  if (mode === "custom_domain" && !isCustomDomainRelayReady(user, isEmailRelayConfigured())) {
    return NextResponse.json(
      { error: "Verify a Pro custom sending domain before enabling it" },
      { status: 400 }
    );
  }

  await db.update(users).set({ followUpEmailMode: mode }).where(eq(users.id, userId));

  return NextResponse.json({ success: true, mode });
}
