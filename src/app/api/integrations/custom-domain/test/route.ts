import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isEmailRelayConfigured, sendViaCustomDomainRelay } from "@/lib/email";
import { isPro } from "@/lib/plans";

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
  const requestedToEmail = String(body?.toEmail || "")
    .trim()
    .toLowerCase();
  const fallbackEmail = session.user.email?.trim().toLowerCase() || "";
  const toEmail = requestedToEmail || fallbackEmail;

  if (!toEmail) {
    return NextResponse.json(
      { error: "A destination email is required for the test send" },
      { status: 400 }
    );
  }

  const db = getDb();
  const userId = Number(session.user.id);
  const [user] = await db
    .select({
      customSendingDomain: users.customSendingDomain,
      customSendingDomainStatus: users.customSendingDomainStatus,
      customSendingFromEmail: users.customSendingFromEmail,
      customSendingFromName: users.customSendingFromName,
      customSendingReplyToEmail: users.customSendingReplyToEmail,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (
    !user?.customSendingDomain ||
    user.customSendingDomainStatus !== "verified" ||
    !user.customSendingFromEmail
  ) {
    return NextResponse.json(
      { error: "Save and verify the custom sending domain before sending a test email" },
      { status: 400 }
    );
  }

  await sendViaCustomDomainRelay({
    to: toEmail,
    subject: "OpenHouse custom domain test",
    text: [
      "This is a live test email from your verified OpenHouse team domain.",
      `Domain: ${user.customSendingDomain}`,
      `From: ${user.customSendingFromEmail}`,
      "",
      "If you received this message, your custom-domain relay is ready for client follow-ups.",
    ].join("\n"),
    fromEmail: user.customSendingFromEmail,
    fromName: user.customSendingFromName,
    replyTo: user.customSendingReplyToEmail || fallbackEmail || undefined,
  });

  await db
    .update(users)
    .set({
      customSendingLastError: null,
    })
    .where(eq(users.id, userId));

  return NextResponse.json({
    success: true,
    toEmail,
    domain: user.customSendingDomain,
  });
}
