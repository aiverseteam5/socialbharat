import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createOrder } from "@/lib/razorpay";
import { calculateGST } from "@/lib/gst";
import { logger } from "@/lib/logger";

/**
 * POST /api/billing/checkout
 * Create a Razorpay order for the selected plan.
 * Requires the caller to be an owner or admin of the org they're billing.
 */

const checkoutSchema = z.object({
  plan: z.enum(["free", "starter", "pro", "business", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  billingState: z.string().min(1).max(50).optional(),
  gstNumber: z.string().min(1).max(15).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.errors },
        { status: 400 },
      );
    }

    // Must be owner or admin of exactly one org to initiate a purchase.
    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

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

    const orgId = membership.org_id;

    const { data: plan } = await supabase
      .from("plan_limits")
      .select("plan, price_monthly_inr, price_yearly_inr")
      .eq("plan", parsed.data.plan)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Free plan short-circuit — no payment needed.
    if (parsed.data.plan === "free") {
      const { error: updErr } = await supabase
        .from("organizations")
        .update({ plan: "free", plan_expires_at: null })
        .eq("id", orgId);
      if (updErr) {
        logger.error("Free plan downgrade failed", updErr, { orgId });
        return NextResponse.json(
          { error: "Failed to update plan" },
          { status: 500 },
        );
      }
      return NextResponse.json({
        success: true,
        plan: "free",
        requiresPayment: false,
      });
    }

    // plan_limits.price_*_inr is PAISE (see migration 00005).
    const baseAmount =
      parsed.data.billingCycle === "monthly"
        ? plan.price_monthly_inr
        : plan.price_yearly_inr;

    const companyState = process.env.COMPANY_GST_STATE || "Karnataka";
    const customerState = parsed.data.billingState || companyState;
    const gstBreakdown = calculateGST(baseAmount, customerState, companyState);

    const { error: billingUpdErr } = await supabase
      .from("organizations")
      .update({
        gst_number: parsed.data.gstNumber || null,
        billing_state: parsed.data.billingState || null,
      })
      .eq("id", orgId);
    if (billingUpdErr) {
      logger.error("Billing details update failed", billingUpdErr, { orgId });
      return NextResponse.json(
        { error: "Failed to save billing details" },
        { status: 500 },
      );
    }

    const order = await createOrder({
      amount: gstBreakdown.totalAmount, // paise — Razorpay's contract
      currency: "INR",
      orgId,
      receipt: `checkout_${parsed.data.plan}_${parsed.data.billingCycle}`,
      notes: {
        plan: parsed.data.plan,
        billing_cycle: parsed.data.billingCycle,
        gst_number: parsed.data.gstNumber || "",
        billing_state: parsed.data.billingState || "",
        base_amount: String(baseAmount), // paise; webhook uses this for GST
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      orgId,
      gstBreakdown,
      plan: parsed.data.plan,
      billingCycle: parsed.data.billingCycle,
    });
  } catch (error) {
    logger.error("Checkout failed", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
