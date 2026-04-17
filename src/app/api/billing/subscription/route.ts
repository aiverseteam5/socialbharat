import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cancelSubscription as razorpayCancelSubscription } from "@/lib/razorpay";
import { logger } from "@/lib/logger";

async function resolveOrgForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return membership;
}

/** GET /api/billing/subscription — current subscription details. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await resolveOrgForUser(supabase, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .single();
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    const { data: planLimits } = await supabase
      .from("plan_limits")
      .select("*")
      .eq("plan", org.plan)
      .single();

    return NextResponse.json({
      plan: org.plan,
      planExpiresAt: org.plan_expires_at,
      razorpayCustomerId: org.razorpay_customer_id,
      razorpaySubscriptionId: org.razorpay_subscription_id,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscriptionId: org.stripe_subscription_id,
      gstNumber: org.gst_number,
      billingState: org.billing_state,
      planLimits: planLimits || null,
    });
  } catch (error) {
    logger.error("Failed to fetch subscription", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
}

const updateSubscriptionSchema = z.object({
  plan: z.enum(["free", "starter", "pro", "business", "enterprise"]),
});

/** PUT /api/billing/subscription — owner/admin changes plan. */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const membership = await resolveOrgForUser(supabase, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only organization owners or admins can manage billing" },
        { status: 403 },
      );
    }

    if (parsed.data.plan !== "free") {
      return NextResponse.json({
        requiresCheckout: true,
        plan: parsed.data.plan,
      });
    }

    const { error: updErr } = await supabase
      .from("organizations")
      .update({ plan: "free", plan_expires_at: null })
      .eq("id", membership.org_id);
    if (updErr) {
      logger.error("Plan downgrade failed", updErr, {
        orgId: membership.org_id,
      });
      return NextResponse.json(
        { error: "Failed to update plan" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, plan: "free" });
  } catch (error) {
    logger.error("Failed to update subscription", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/billing/subscription — owner/admin cancels subscription.
 *
 * Calls Razorpay's subscriptions.cancel so the customer stops being
 * charged, and only updates our DB after Razorpay confirms. If Razorpay
 * rejects the cancel we surface the error and leave DB state intact.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await resolveOrgForUser(supabase, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 },
      );
    }
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only organization owners or admins can manage billing" },
        { status: 403 },
      );
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("plan_expires_at, razorpay_subscription_id")
      .eq("id", membership.org_id)
      .single();
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Use the service client for the final plan write so webhook-driven
    // rows that were created by the service role can still be updated.
    const service = createServiceClient();

    if (org.razorpay_subscription_id) {
      try {
        const cancelled = await razorpayCancelSubscription(
          org.razorpay_subscription_id,
          true, // cancelAtCycleEnd — customer keeps access until period end
        );
        const expiresAt = cancelled.current_end
          ? new Date(cancelled.current_end * 1000).toISOString()
          : (org.plan_expires_at ?? null);

        const { error } = await service
          .from("organizations")
          .update({
            plan: "free",
            plan_expires_at: expiresAt,
          })
          .eq("id", membership.org_id);
        if (error) {
          logger.error("DB update after Razorpay cancel failed", error, {
            orgId: membership.org_id,
          });
          return NextResponse.json(
            { error: "Cancel succeeded at Razorpay but DB update failed" },
            { status: 500 },
          );
        }
      } catch (err) {
        logger.error("Razorpay subscription cancel failed", err, {
          orgId: membership.org_id,
          subscriptionId: org.razorpay_subscription_id,
        });
        return NextResponse.json(
          {
            error: "Failed to cancel subscription at Razorpay",
            detail: err instanceof Error ? err.message : "Unknown error",
          },
          { status: 502 },
        );
      }
    } else {
      // No active Razorpay subscription — downgrade immediately.
      const { error } = await service
        .from("organizations")
        .update({ plan: "free", plan_expires_at: null })
        .eq("id", membership.org_id);
      if (error) {
        logger.error("Immediate plan downgrade failed", error, {
          orgId: membership.org_id,
        });
        return NextResponse.json(
          { error: "Failed to downgrade plan" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to cancel subscription", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
