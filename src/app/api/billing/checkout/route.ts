import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getCheckoutCancelUrl,
  getCheckoutSuccessUrl,
  resolvePlanTier,
} from "@/lib/billing";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
const STRIPE_APP_ID = "openhouse";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
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
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (resolvePlanTier({ subscriptionTier: user.subscriptionTier, email: user.email }) === "pro") {
    return NextResponse.json(
      { error: "This account already has Pro access." },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRO_PRICE_ID as string;

  const sessionUrl = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: user.stripeCustomerId || undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    client_reference_id: String(user.id),
    success_url: getCheckoutSuccessUrl(),
    cancel_url: getCheckoutCancelUrl(),
    allow_promotion_codes: true,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        app: STRIPE_APP_ID,
        userId: String(user.id),
      },
    },
    metadata: {
      app: STRIPE_APP_ID,
      userId: String(user.id),
    },
  });

  return NextResponse.json({ url: sessionUrl.url });
}
