import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/billing/plans
 * Public list of plans with paise prices and feature flags.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: plans, error } = await supabase
      .from("plan_limits")
      .select("*")
      .order("price_monthly_inr", { ascending: true });

    if (error) {
      logger.error("Failed to fetch plans", error);
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 },
      );
    }

    const formattedPlans = (plans ?? []).map((plan) => ({
      id: plan.plan,
      name: plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1),
      monthlyPrice: plan.price_monthly_inr, // paise
      yearlyPrice: plan.price_yearly_inr, // paise
      features: {
        maxSocialProfiles: plan.max_social_profiles,
        maxUsers: plan.max_users,
        maxPostsPerMonth: plan.max_posts_per_month,
        maxScheduledPosts: plan.max_scheduled_posts,
        aiContentGeneration: plan.ai_content_generation,
        socialListening: plan.social_listening,
        customReports: plan.custom_reports,
        approvalWorkflows: plan.approval_workflows,
        whatsappInbox: plan.whatsapp_inbox,
        apiAccess: plan.api_access,
      },
    }));

    return NextResponse.json({ plans: formattedPlans });
  } catch (error) {
    logger.error("Failed to fetch plans", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 },
    );
  }
}
