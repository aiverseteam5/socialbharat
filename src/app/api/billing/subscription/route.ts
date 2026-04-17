import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/billing/subscription
 * Return current subscription details
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = orgMember.org_id

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get plan limits
    const { data: planLimits } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan', org.plan)
      .single()

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
    })
  } catch (error) {
    console.error('Failed to fetch subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

const updateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'business', 'enterprise']),
})

/**
 * PUT /api/billing/subscription
 * Upgrade or downgrade plan
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateSubscriptionSchema.parse(body)

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = orgMember.org_id

    // For paid plans, redirect to checkout
    if (parsed.plan !== 'free') {
      return NextResponse.json({
        requiresCheckout: true,
        plan: parsed.plan,
      })
    }

    // Downgrade to free plan
    await supabase
      .from('organizations')
      .update({
        plan: 'free',
        plan_expires_at: null,
      })
      .eq('id', orgId)

    return NextResponse.json({ success: true, plan: 'free' })
  } catch (error) {
    console.error('Failed to update subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/billing/subscription
 * Cancel subscription (effective at period end)
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = orgMember.org_id

    // Get current org details
    const { data: org } = await supabase
      .from('organizations')
      .select('plan_expires_at, razorpay_subscription_id')
      .eq('id', orgId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // If there's an active Razorpay subscription, cancel it
    if (org.razorpay_subscription_id) {
      // Note: This would require Razorpay API integration
      // For now, we'll just set the plan to expire at the current period end
      await supabase
        .from('organizations')
        .update({
          plan: 'free',
          plan_expires_at: org.plan_expires_at,
        })
        .eq('id', orgId)
    } else {
      // No active subscription, downgrade immediately
      await supabase
        .from('organizations')
        .update({
          plan: 'free',
          plan_expires_at: null,
        })
        .eq('id', orgId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to cancel subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
