import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { revokeGoogleToken } from "@/lib/gmail";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      gmailRefreshTokenEncrypted: users.gmailRefreshTokenEncrypted,
      followUpEmailMode: users.followUpEmailMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.gmailRefreshTokenEncrypted) {
    await revokeGoogleToken(user.gmailRefreshTokenEncrypted);
  }

  await db
    .update(users)
    .set({
      gmailRefreshTokenEncrypted: null,
      gmailSendAsEmail: null,
      gmailSendingEnabled: false,
      gmailConnectedAt: null,
      gmailLastSendError: null,
      ...(user?.followUpEmailMode === "google" ? { followUpEmailMode: "draft" as const } : {}),
    })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
