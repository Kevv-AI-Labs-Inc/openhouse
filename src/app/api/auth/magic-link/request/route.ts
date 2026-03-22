import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { magicLinks } from "@/lib/db/schema";
import { sanitizeCallbackUrl } from "@/lib/auth-ux";
import { sendSystemEmail, isSystemEmailConfigured } from "@/lib/email";
import {
  buildMagicLinkEmailText,
  buildMagicLinkUrl,
  createMagicLinkToken,
  getMagicLinkExpiry,
  normalizeMagicLinkEmail,
} from "@/lib/magic-link";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const requestSchema = z.object({
  email: z.email(),
  callbackUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!isSystemEmailConfigured()) {
    return NextResponse.json(
      { error: "Magic link delivery is not configured" },
      { status: 503 }
    );
  }

  const ipAddress = getClientIp(request.headers);
  const ipRateLimit = await checkRateLimit({
    key: `magic-link:ip:${ipAddress}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!ipRateLimit.ok) {
    return NextResponse.json(
      { error: "Too many sign-in link requests. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const email = normalizeMagicLinkEmail(payload.email);
  const redirectPath = sanitizeCallbackUrl(payload.callbackUrl);
  const emailRateLimit = await checkRateLimit({
    key: `magic-link:email:${email}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!emailRateLimit.ok) {
    return NextResponse.json(
      { error: "Too many sign-in link requests for this email. Please wait a few minutes." },
      { status: 429 }
    );
  }

  const db = getDb();
  const { token, tokenHash } = createMagicLinkToken();
  const expiresAt = getMagicLinkExpiry();

  await db.delete(magicLinks).where(eq(magicLinks.email, email));
  await db.insert(magicLinks).values({
    email,
    tokenHash,
    redirectPath,
    expiresAt,
  });

  const signInUrl = buildMagicLinkUrl(token, redirectPath);

  await sendSystemEmail({
    to: email,
    subject: "Your secure OpenHouse sign-in link",
    text: buildMagicLinkEmailText(signInUrl),
  });

  return NextResponse.json({
    success: true,
    expiresInMinutes: 15,
    message: "If the address is valid, a one-time sign-in link is on its way.",
  });
}
