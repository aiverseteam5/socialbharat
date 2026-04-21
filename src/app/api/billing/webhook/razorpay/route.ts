import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { generateInvoice } from "@/lib/invoice";
import { calculateGST } from "@/lib/gst";
import { serverTrack } from "@/lib/analytics-server";
import { sendNotificationVoid } from "@/lib/notifications/send";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/billing/webhook/razorpay
 *
 * Processes Razorpay webhook events. Contract:
 *   - 200 on success or duplicate (already processed)
 *   - 400 on missing/invalid signature (don't leak details, don't retry)
 *   - 500 on processing error (Razorpay will retry)
 *
 * Uses the service-role Supabase client because Razorpay's server has no
 * user session — anon-key + RLS would silently drop every write.
 *
 * Idempotency: check first, process, then insert the event_id. On
 * failure we intentionally skip the insert so a retry can reprocess.
 */

type Supabase = ReturnType<typeof createServiceClient>;

interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  customer_id?: string;
  notes?: Record<string, string>;
}

interface RazorpaySubscription {
  id: string;
  current_end: number;
  notes?: Record<string, string>;
}

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    subscription?: { entity: RazorpaySubscription };
  };
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  if (!verifyWebhookSignature(webhookSecret, body, signature)) {
    logger.warn("Invalid Razorpay webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(body) as RazorpayEvent;
  } catch (err) {
    logger.error("Razorpay webhook body is not valid JSON", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventId = extractEventId(event);
  if (!eventId) {
    logger.error(
      "Could not extract event id from Razorpay webhook",
      undefined,
      {
        eventType: event.event,
      },
    );
    return NextResponse.json(
      { error: "Missing event entity id" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Idempotency check — if we've seen this event id, skip.
  const { data: existing, error: existingErr } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "razorpay")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingErr) {
    logger.error("Failed to query webhook_events", existingErr, { eventId });
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  // Process first; only record the event_id on success so retries work.
  try {
    await dispatchEvent(event, supabase);
  } catch (err) {
    logger.error("Razorpay webhook handler failed", err, {
      eventId,
      eventType: event.event,
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  const { error: insertErr } = await supabase.from("webhook_events").insert({
    provider: "razorpay",
    event_id: eventId,
    event_type: event.event,
    payload: event,
  });
  if (insertErr) {
    logger.error("Failed to record processed webhook event", insertErr, {
      eventId,
    });
    // The work succeeded; allow Razorpay to retry so the record lands.
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function extractEventId(event: RazorpayEvent): string | null {
  if (event.payload.payment?.entity?.id) {
    return event.payload.payment.entity.id;
  }
  if (event.payload.subscription?.entity?.id) {
    return event.payload.subscription.entity.id;
  }
  return null;
}

async function dispatchEvent(
  event: RazorpayEvent,
  supabase: Supabase,
): Promise<void> {
  switch (event.event) {
    case "payment.captured":
      await handlePaymentCaptured(event.payload.payment!.entity, supabase);
      return;
    case "subscription.activated":
      await handleSubscriptionActivated(
        event.payload.subscription!.entity,
        supabase,
      );
      return;
    case "subscription.charged":
      await handleSubscriptionCharged(
        event.payload.subscription!.entity,
        supabase,
      );
      return;
    case "subscription.cancelled":
      await handleSubscriptionCancelled(
        event.payload.subscription!.entity,
        supabase,
      );
      return;
    case "payment.failed":
      await handlePaymentFailed(event.payload.payment!.entity, supabase);
      return;
    default:
      logger.info("Razorpay webhook event type ignored", {
        eventType: event.event,
      });
  }
}

async function handlePaymentCaptured(
  payment: RazorpayPayment,
  supabase: Supabase,
): Promise<void> {
  const notes = payment.notes ?? {};
  const orgId = notes.org_id;
  const plan = notes.plan;
  const billingCycle = notes.billing_cycle;
  const billingState = notes.billing_state || undefined;
  const gstNumber = notes.gst_number || undefined;
  const baseAmountPaise = Number(notes.base_amount) || 0;

  if (!orgId) {
    throw new Error("payment.captured missing org_id in notes");
  }

  const planExpiresAt =
    billingCycle === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { error: updErr } = await supabase
    .from("organizations")
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      razorpay_customer_id: payment.customer_id ?? null,
    })
    .eq("id", orgId);
  if (updErr) throw new Error(`Plan update failed: ${updErr.message}`);

  // Recompute GST from the customer state so the invoice matches what was
  // shown at checkout. If base_amount wasn't carried on the notes we fall
  // back to the gross payment amount (which already includes GST).
  const gross = baseAmountPaise > 0 ? baseAmountPaise : payment.amount;
  const companyState = process.env.COMPANY_GST_STATE || "Karnataka";
  const gstBreakdown = calculateGST(
    gross,
    billingState || companyState,
    companyState,
  );

  await generateInvoice({
    orgId,
    razorpayPaymentId: payment.id,
    baseAmount: gross,
    currency: payment.currency,
    gstBreakdown,
    gstNumber,
    billingState,
  });

  void serverTrack(orgId, "converted_to_paid", {
    plan,
    billing_cycle: billingCycle,
    amount: payment.amount,
    payment_id: payment.id,
  });

  // Notify org owner
  const { data: owner } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (owner) {
    sendNotificationVoid({
      userId: owner.user_id,
      orgId,
      type: "payment_received",
      title: "Payment received",
      body: `₹${(payment.amount / 100).toFixed(2)} received. Your ${plan ?? "plan"} is now active.`,
      link: "/settings/billing",
    });
  }
}

async function handleSubscriptionActivated(
  subscription: RazorpaySubscription,
  supabase: Supabase,
): Promise<void> {
  const notes = subscription.notes ?? {};
  const orgId = notes.org_id;
  const plan = notes.plan;
  if (!orgId) {
    throw new Error("subscription.activated missing org_id in notes");
  }

  const planExpiresAt = new Date(subscription.current_end * 1000);

  const { error } = await supabase
    .from("organizations")
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      razorpay_subscription_id: subscription.id,
    })
    .eq("id", orgId);
  if (error)
    throw new Error(`Subscription activation failed: ${error.message}`);
}

async function handleSubscriptionCharged(
  subscription: RazorpaySubscription,
  supabase: Supabase,
): Promise<void> {
  const notes = subscription.notes ?? {};
  const orgId = notes.org_id;
  if (!orgId) {
    throw new Error("subscription.charged missing org_id in notes");
  }

  const planExpiresAt = new Date(subscription.current_end * 1000);

  const { error } = await supabase
    .from("organizations")
    .update({ plan_expires_at: planExpiresAt.toISOString() })
    .eq("id", orgId);
  if (error) throw new Error(`Subscription renewal failed: ${error.message}`);
}

async function handleSubscriptionCancelled(
  subscription: RazorpaySubscription,
  supabase: Supabase,
): Promise<void> {
  const notes = subscription.notes ?? {};
  const orgId = notes.org_id;
  if (!orgId) {
    throw new Error("subscription.cancelled missing org_id in notes");
  }

  const planExpiresAt = new Date(subscription.current_end * 1000);

  const { error } = await supabase
    .from("organizations")
    .update({
      plan: "free",
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq("id", orgId);
  if (error)
    throw new Error(`Subscription cancellation failed: ${error.message}`);
}

async function handlePaymentFailed(
  payment: RazorpayPayment,
  supabase: Supabase,
): Promise<void> {
  const notes = payment.notes ?? {};
  const orgId = notes.org_id;
  if (!orgId) {
    throw new Error("payment.failed missing org_id in notes");
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: null,
    org_id: orgId,
    type: "payment_failed",
    title: "Payment Failed",
    body: `Your payment of ₹${(payment.amount / 100).toFixed(2)} failed. Please try again.`,
    link: "/settings/billing",
  });
  if (error) throw new Error(`Notification insert failed: ${error.message}`);
}
