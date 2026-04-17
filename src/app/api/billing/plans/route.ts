import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/billing/plans
 * Return all available plans with features and INR pricing
 * Public route (no auth required)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: plans, error } = await supabase
      .from('plan_limits')
      .select('*')
      .order('price_monthly_inr', { ascending: true })

    if (error) {
      throw error
    }

    // Format plans for frontend
    const formattedPlans = plans?.map((plan) => ({
      id: plan.plan,
      name: plan.plan.charAt(0).toUpperCase() + plan.plan.slice(1),
      monthlyPrice: plan.price_monthly_inr,
      yearlyPrice: plan.price_yearly_inr,
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
    }))

    return NextResponse.json({ plans: formattedPlans })
  } catch (error) {
    console.error('Failed to fetch plans:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}
