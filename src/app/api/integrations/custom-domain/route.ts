import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isEmailRelayConfigured, lookupRelayDomain, normalizeDomain } from "@/lib/email";
import { isPro } from "@/lib/plans";

function getDomainFromEmail(email: string) {
  return email.split("@")[1]?.trim().toLowerCase() || "";
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPro(session.user.subscriptionTier)) {
    return NextResponse.json(
      { error: "Custom sending domains are available on Pro only" },
      { status: 403 }
    );
  }

  if (!isEmailRelayConfigured()) {
    return NextResponse.json({ error: "Email relay is not configured" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const domain = normalizeDomain(body?.domain || "");
  const fromEmail = String(body?.fromEmail || "").trim().toLowerCase();
  const fromName = String(body?.fromName || "").trim();
  const replyToEmail = String(body?.replyToEmail || "").trim().toLowerCase();

  if (!domain || !fromEmail) {
    return NextResponse.json(
      { error: "Domain and from email are required" },
      { status: 400 }
    );
  }

  if (getDomainFromEmail(fromEmail) !== domain) {
    return NextResponse.json(
      { error: "From email must belong to the verified domain" },
      { status: 400 }
    );
  }

  const relayDomain = await lookupRelayDomain(domain).catch(() => null);
  const relayStatus = relayDomain?.status?.trim().toLowerCase() || "";
  const status =
    relayStatus === "verified"
      ? "verified"
      : relayDomain
        ? "pending"
        : "pending";

  const db = getDb();
  const userId = Number(session.user.id);

  await db
    .update(users)
    .set({
      customSendingDomain: domain,
      customSendingDomainId: relayDomain?.id || null,
      customSendingDomainStatus: status,
      customSendingFromEmail: fromEmail,
      customSendingFromName: fromName || null,
      customSendingReplyToEmail: replyToEmail || null,
      customSendingLastError:
        status === "verified"
          ? null
          : "Verify this domain in Resend before using it for client follow-ups.",
    })
    .where(eq(users.id, userId));

  return NextResponse.json({
    success: true,
    domain,
    status,
    relayFound: Boolean(relayDomain),
  });
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({ followUpEmailMode: users.followUpEmailMode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({
      customSendingDomain: null,
      customSendingDomainId: null,
      customSendingDomainStatus: "not_started",
      customSendingFromEmail: null,
      customSendingFromName: null,
      customSendingReplyToEmail: null,
      customSendingLastError: null,
      ...(user?.followUpEmailMode === "custom_domain"
        ? { followUpEmailMode: "draft" as const }
        : {}),
    })
    .where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
