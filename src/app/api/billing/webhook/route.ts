import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  downgradeUserToFreeByCustomer,
  syncSubscriptionState,
  UnmappedStripeSubscriptionError,
} from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
const STRIPE_APP_ID = "openhouse";

function getStripeEvent(requestBody: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const stripe = getStripe();
  return stripe.webhooks.constructEvent(requestBody, signature, webhookSecret);
}

function parseUserId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price?.id ?? null;
}

function isOpenHouseSubscription(subscription: Stripe.Subscription) {
  const configuredPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const metadataApp = subscription.metadata?.app;
  const priceId = getSubscriptionPriceId(subscription);

  if (metadataApp === STRIPE_APP_ID) {
    return true;
  }

  return Boolean(configuredPriceId && priceId === configuredPriceId);
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripeEvent(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && typeof session.subscription === "string") {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(session.subscription);

          if (!isOpenHouseSubscription(subscription)) {
            return NextResponse.json({ received: true, ignored: true });
          }

          const fallbackCustomerId =
            typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

          await syncSubscriptionState(subscription, {
            fallbackUserId: parseUserId(session.client_reference_id),
            fallbackCustomerId,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        if (!isOpenHouseSubscription(subscription)) {
          return NextResponse.json({ received: true, ignored: true });
        }
        await syncSubscriptionState(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (!isOpenHouseSubscription(subscription)) {
          return NextResponse.json({ received: true, ignored: true });
        }
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;

        if (customerId) {
          await downgradeUserToFreeByCustomer(customerId);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    if (error instanceof UnmappedStripeSubscriptionError) {
      console.warn("[Stripe webhook] Ignoring unmapped subscription event", {
        eventId: event.id,
        eventType: event.type,
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    console.error("[Stripe webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
