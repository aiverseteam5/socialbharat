import { createClient } from '@/lib/supabase/server'
import { createOrder } from '@/lib/razorpay'
import { calculateGST } from '@/lib/gst'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/billing/checkout
 * Create Razorpay order for selected plan
 * Requires authentication
 */

const checkoutSchema = z.object({
  plan: z.enum(['free', 'starter', 'pro', 'business', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']),
  billingState: z.string().optional(),
  gstNumber: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = checkoutSchema.parse(body)

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

    // Get plan details
    const { data: plan } = await supabase
      .from('plan_limits')
      .select('*')
      .eq('plan', parsed.plan)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Determine base amount (in paise)
    const baseAmount = parsed.billingCycle === 'monthly' 
      ? plan.price_monthly_inr 
      : plan.price_yearly_inr

    // Free plan doesn't need payment
    if (parsed.plan === 'free') {
      // Update org to free plan directly
      await supabase
        .from('organizations')
        .update({ 
          plan: 'free',
          plan_expires_at: null,
        })
        .eq('id', orgId)

      return NextResponse.json({ 
        success: true,
        plan: 'free',
        requiresPayment: false,
      })
    }

    // Calculate GST if billing state provided
    let gstBreakdown
    if (parsed.billingState) {
      const companyState = process.env.COMPANY_GST_STATE || 'Karnataka'
      gstBreakdown = calculateGST(baseAmount, parsed.billingState, companyState)
    } else {
      // Default to intra-state (company state)
      const companyState = process.env.COMPANY_GST_STATE || 'Karnataka'
      gstBreakdown = calculateGST(baseAmount, companyState, companyState)
    }

    // Update org with billing details
    await supabase
      .from('organizations')
      .update({
        gst_number: parsed.gstNumber || null,
        billing_state: parsed.billingState || null,
      })
      .eq('id', orgId)

    // Create Razorpay order
    const order = await createOrder({
      amount: gstBreakdown.totalAmount,
      currency: 'INR',
      orgId,
      receipt: `checkout_${parsed.plan}_${parsed.billingCycle}`,
      notes: {
        plan: parsed.plan,
        billing_cycle: parsed.billingCycle,
        gst_number: parsed.gstNumber || '',
        billing_state: parsed.billingState || '',
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      orgId,
      gstBreakdown,
      plan: parsed.plan,
      billingCycle: parsed.billingCycle,
    })
  } catch (error) {
    console.error('Checkout failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    )
  }
}
