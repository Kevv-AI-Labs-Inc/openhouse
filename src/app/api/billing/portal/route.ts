import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getBillingPortalReturnUrl } from "@/lib/billing";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured for this environment" },
      { status: 503 }
    );
  }

  const db = getDb();
  const [user] = await db
    .select({
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer is attached to this account yet" },
      { status: 404 }
    );
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: getBillingPortalReturnUrl(),
  });

  return NextResponse.json({ url: portalSession.url });
}
