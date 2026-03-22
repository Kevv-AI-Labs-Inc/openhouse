import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isGmailDirectSendAvailable } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const enabled = body?.enabled;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      gmailRefreshTokenEncrypted: users.gmailRefreshTokenEncrypted,
      gmailSendAsEmail: users.gmailSendAsEmail,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (
    enabled &&
    (!isGmailDirectSendAvailable() ||
      !user.gmailRefreshTokenEncrypted ||
      !user.gmailSendAsEmail)
  ) {
    return NextResponse.json(
      { error: "Connect Gmail before enabling direct send" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set(
      enabled
        ? {
            gmailSendingEnabled: true,
            gmailLastSendError: null,
          }
        : {
            gmailSendingEnabled: false,
          }
    )
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, enabled });
}
