import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { generateInvoice } from "@/lib/invoice";
import { calculateGST } from "@/lib/gst";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook/stripe
 *
 * Processes Stripe webhook events. Same error contract as the Razorpay
 * handler: 200 on success / duplicate, 400 on bad signature, 500 on
 * processing failure so Stripe retries.
 */

type Supabase = ReturnType<typeof createServiceClient>;

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !stripeKey) {
    logger.error("Stripe webhook/secret env vars not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.warn("Invalid Stripe webhook signature", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing, error: existingErr } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingErr) {
    logger.error("Failed to query webhook_events", existingErr, {
      eventId: event.id,
    });
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  try {
    await dispatchEvent(event, stripe, supabase);
  } catch (err) {
    logger.error("Stripe webhook handler failed", err, {
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  const { error: insertErr } = await supabase.from("webhook_events").insert({
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });
  if (insertErr) {
    logger.error("Failed to record processed webhook event", insertErr, {
      eventId: event.id,
    });
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function dispatchEvent(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: Supabase,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        supabase,
      );
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(
        event.data.object as Stripe.Subscription,
        supabase,
      );
      return;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(
        event.data.object as Stripe.Invoice,
        stripe,
        supabase,
      );
      return;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(
        event.data.object as Stripe.Invoice,
        supabase,
      );
      return;
    default:
      logger.info("Stripe webhook event type ignored", {
        eventType: event.type,
      });
  }
}

function requireOrgId(
  metadata: Stripe.Metadata | null | undefined,
  eventLabel: string,
): string {
  const orgId = metadata?.org_id;
  if (!orgId) {
    throw new Error(`${eventLabel} missing org_id in metadata`);
  }
  return orgId;
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: Supabase,
): Promise<void> {
  const orgId = requireOrgId(session.metadata, "checkout.session.completed");
  const plan = session.metadata?.plan || "pro";
  const billingCycle = session.metadata?.billing_cycle;
  const billingState = session.metadata?.billing_state || undefined;
  const gstNumber = session.metadata?.gst_number || undefined;

  const planExpiresAt =
    billingCycle === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { error: updErr } = await supabase
    .from("organizations")
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : null,
    })
    .eq("id", orgId);
  if (updErr) throw new Error(`Plan update failed: ${updErr.message}`);

  const totalAmount = session.amount_total ?? 0;
  const currency = session.currency?.toUpperCase() || "USD";

  // Stripe checkout is primarily international — only run GST for INR.
  const gstBreakdown =
    currency === "INR" && billingState
      ? calculateGST(
          totalAmount,
          billingState,
          process.env.COMPANY_GST_STATE || "Karnataka",
        )
      : {
          baseAmount: totalAmount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalAmount,
          isInterState: false,
        };

  await generateInvoice({
    orgId,
    stripePaymentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : undefined,
    baseAmount: totalAmount,
    currency,
    gstBreakdown,
    gstNumber,
    billingState,
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: Supabase,
): Promise<void> {
  const orgId = requireOrgId(
    subscription.metadata,
    "customer.subscription.deleted",
  );
  const planExpiresAt = new Date(subscription.current_period_end * 1000);

  const { error } = await supabase
    .from("organizations")
    .update({
      plan: "free",
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq("id", orgId);
  if (error) throw new Error(`Subscription delete failed: ${error.message}`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  stripe: Stripe,
  supabase: Supabase,
): Promise<void> {
  const orgId = requireOrgId(invoice.metadata, "invoice.payment_succeeded");

  if (invoice.subscription) {
    const subscriptionId =
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planExpiresAt = new Date(subscription.current_period_end * 1000);

    const { error } = await supabase
      .from("organizations")
      .update({ plan_expires_at: planExpiresAt.toISOString() })
      .eq("id", orgId);
    if (error) throw new Error(`Expiry update failed: ${error.message}`);
  }

  const totalAmount = invoice.amount_paid ?? 0;
  const currency = invoice.currency?.toUpperCase() || "USD";
  const gstBreakdown = {
    baseAmount: totalAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount,
    isInterState: false,
  };

  await generateInvoice({
    orgId,
    stripePaymentId:
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : undefined,
    baseAmount: totalAmount,
    currency,
    gstBreakdown,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: Supabase,
): Promise<void> {
  const orgId = requireOrgId(invoice.metadata, "invoice.payment_failed");
  const amount = invoice.amount_due ?? 0;
  const currency = invoice.currency?.toUpperCase() ?? "USD";

  const { error } = await supabase.from("notifications").insert({
    user_id: null,
    org_id: orgId,
    type: "payment_failed",
    title: "Payment Failed",
    body: `Your payment of ${currency} ${(amount / 100).toFixed(2)} failed. Please try again.`,
    link: "/settings/billing",
  });
  if (error) throw new Error(`Notification insert failed: ${error.message}`);
}
