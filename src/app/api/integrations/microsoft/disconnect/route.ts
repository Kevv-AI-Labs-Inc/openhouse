import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { revokeMicrosoftToken } from "@/lib/microsoft";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      microsoftRefreshTokenEncrypted: users.microsoftRefreshTokenEncrypted,
      followUpEmailMode: users.followUpEmailMode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.microsoftRefreshTokenEncrypted) {
    await revokeMicrosoftToken();
  }

  await db
    .update(users)
    .set({
      microsoftRefreshTokenEncrypted: null,
      microsoftSendAsEmail: null,
      microsoftSendingEnabled: false,
      microsoftConnectedAt: null,
      microsoftLastSendError: null,
      ...(user?.followUpEmailMode === "microsoft"
        ? { followUpEmailMode: "draft" as const }
        : {}),
    })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
