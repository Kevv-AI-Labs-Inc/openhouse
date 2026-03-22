import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isEmailRelayConfigured, lookupRelayDomain } from "@/lib/email";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailRelayConfigured()) {
    return NextResponse.json({ error: "Email relay is not configured" }, { status: 400 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      customSendingDomain: users.customSendingDomain,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.customSendingDomain) {
    return NextResponse.json({ error: "No custom domain saved" }, { status: 400 });
  }

  const relayDomain = await lookupRelayDomain(user.customSendingDomain).catch(() => null);
  const relayStatus = relayDomain?.status?.trim().toLowerCase() || "";
  const status = relayStatus === "verified" ? "verified" : relayDomain ? "pending" : "failed";

  await db
    .update(users)
    .set({
      customSendingDomainId: relayDomain?.id || null,
      customSendingDomainStatus: status,
      customSendingLastError:
        status === "verified"
          ? null
          : relayDomain
            ? "Domain found in Resend but DNS verification is still pending."
            : "This domain was not found in the current Resend account.",
    })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true, status, relayFound: Boolean(relayDomain) });
}
