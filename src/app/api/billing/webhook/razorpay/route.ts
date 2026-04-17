import { createClient } from '@/lib/supabase/server'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { generateInvoice } from '@/lib/invoice'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/billing/webhook/razorpay
 * Handle Razorpay webhook events
 * CRITICAL: Verify signature and check idempotency before processing
 */
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Get signature from header
    const signature = request.headers.get('x-razorpay-signature')
    if (!signature) {
      console.error('Missing Razorpay signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Get raw body for signature verification
    const body = await request.text()

    // Verify webhook signature
    const isValid = verifyWebhookSignature(webhookSecret, body, signature)
    if (!isValid) {
      console.error('Invalid Razorpay webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const eventId = event.payload?.payment?.entity?.id || event.id
    const eventType = event.event

    // Check idempotency - if event already processed, skip
    const supabase = await createClient()
    
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'razorpay')
      .eq('event_id', eventId)
      .single()

    if (existingEvent) {
      console.log(`Event ${eventId} already processed, skipping`)
      return NextResponse.json({ success: true, message: 'Event already processed' })
    }

    // Insert webhook event record for idempotency
    await supabase
      .from('webhook_events')
      .insert({
        provider: 'razorpay',
        event_id: eventId,
        event_type: eventType,
        payload: event,
      })

    // Handle different event types
    switch (eventType) {
      case 'payment.captured':
        await handlePaymentCaptured(event, supabase)
        break

      case 'subscription.activated':
        await handleSubscriptionActivated(event, supabase)
        break

      case 'subscription.charged':
        await handleSubscriptionCharged(event, supabase)
        break

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event, supabase)
        break

      case 'payment.failed':
        await handlePaymentFailed(event, supabase)
        break

      default:
        console.log(`Unhandled event type: ${eventType}`)
    }

    // Always return 200 to Razorpay (they retry on non-200)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing failed:', error)
    // Still return 200 to avoid retry loops
    return NextResponse.json({ success: true })
  }
}

async function handlePaymentCaptured(event: { payload: { payment: { entity: Record<string, unknown> } } }, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const payment = event.payload.payment.entity
  const notes = payment.notes as Record<string, string>
  const orgId = notes.org_id
  const plan = notes.plan
  const billingCycle = notes.billing_cycle

  if (!orgId) {
    console.error('Missing org_id in payment notes')
    return
  }

  // Update organization plan
  const planExpiresAt = billingCycle === 'yearly' 
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await supabase
    .from('organizations')
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      razorpay_customer_id: payment.customer_id,
    })
    .eq('id', orgId)

  // Generate invoice
  const baseAmount = payment.amount as number
  const currency = payment.currency as string

  const gstBreakdown = {
    baseAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount: baseAmount,
    isInterState: false,
  }

  await generateInvoice({
    orgId,
    razorpayPaymentId: payment.id as string,
    baseAmount,
    currency,
    gstBreakdown,
    gstNumber: notes.gst_number,
    billingState: notes.billing_state,
  })
}

async function handleSubscriptionActivated(event: { payload: { subscription: { entity: Record<string, unknown> } } }, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const subscription = event.payload.subscription.entity
  const notes = subscription.notes as Record<string, string>
  const orgId = notes.org_id
  const plan = notes.plan

  if (!orgId) {
    console.error('Missing org_id in subscription notes')
    return
  }

  // Calculate plan expiry from subscription end date
  const planExpiresAt = new Date((subscription.current_end as number) * 1000)

  await supabase
    .from('organizations')
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      razorpay_subscription_id: subscription.id as string,
    })
    .eq('id', orgId)
}

async function handleSubscriptionCharged(event: { payload: { subscription: { entity: Record<string, unknown> } } }, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const subscription = event.payload.subscription.entity
  const notes = subscription.notes as Record<string, string>
  const orgId = notes.org_id

  if (!orgId) {
    console.error('Missing org_id in subscription notes')
    return
  }

  // Update plan expiry
  const planExpiresAt = new Date((subscription.current_end as number) * 1000)

  await supabase
    .from('organizations')
    .update({
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq('id', orgId)
}

async function handleSubscriptionCancelled(event: { payload: { subscription: { entity: Record<string, unknown> } } }, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const subscription = event.payload.subscription.entity
  const notes = subscription.notes as Record<string, string>
  const orgId = notes.org_id

  if (!orgId) {
    console.error('Missing org_id in subscription notes')
    return
  }

  // Downgrade to free plan at period end
  const planExpiresAt = new Date((subscription.current_end as number) * 1000)

  await supabase
    .from('organizations')
    .update({
      plan: 'free',
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq('id', orgId)
}

async function handlePaymentFailed(event: { payload: { payment: { entity: Record<string, unknown> } } }, supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => unknown } }) {
  const payment = event.payload.payment.entity
  const notes = payment.notes as Record<string, string>
  const orgId = notes.org_id

  if (!orgId) {
    console.error('Missing org_id in payment notes')
    return
  }

  // Create notification for org owner
  await supabase
    .from('notifications')
    .insert({
      user_id: null, // Will be set by trigger or separate logic
      org_id: orgId,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: `Your payment of ₹${(payment.amount as number) / 100} failed. Please try again.`,
      link: '/settings/billing',
    })
}
