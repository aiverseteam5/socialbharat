import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { generateInvoice } from '@/lib/invoice'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/billing/webhook/stripe
 * Handle Stripe webhook events for international payments
 * Verify signature and check idempotency before processing
 */
export async function POST(request: NextRequest) {
  try {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!stripeSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    // Get signature from header
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      console.error('Missing Stripe signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    // Get raw body for signature verification
    const body = await request.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeSecret)
    } catch (err) {
      console.error('Invalid Stripe webhook signature:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const eventId = event.id
    const eventType = event.type

    // Check idempotency - if event already processed, skip
    const supabase = await createClient()
    
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'stripe')
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
        provider: 'stripe',
        event_id: eventId,
        event_type: eventType,
        payload: event,
      })

    // Handle different event types
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabase)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event, supabase)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event, supabase)
        break

      default:
        console.log(`Unhandled event type: ${eventType}`)
    }

    // Always return 200 to Stripe (they retry on non-200)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Stripe webhook processing failed:', error)
    // Still return 200 to avoid retry loops
    return NextResponse.json({ success: true })
  }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const session = event.data.object as Stripe.Checkout.Session
  const metadata = session.metadata as Record<string, string>

  if (!metadata || !metadata.org_id) {
    console.error('Missing org_id in checkout session metadata')
    return
  }

  const orgId = metadata.org_id
  if (!orgId) {
    console.error('Missing org_id in checkout session metadata')
    return
  }
  const plan = metadata.plan || 'pro'

  // Update organization plan
  const planExpiresAt = metadata.billing_cycle === 'yearly'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await supabase
    .from('organizations')
    .update({
      plan,
      plan_expires_at: planExpiresAt.toISOString(),
      stripe_customer_id: session.customer as string,
    })
    .eq('id', orgId)

  // Generate invoice
  const totalAmount = session.amount_total || 0
  const currency = session.currency?.toUpperCase() || 'USD'

  const gstBreakdown = {
    baseAmount: totalAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount,
    isInterState: false,
  }

  await generateInvoice({
    orgId,
    stripePaymentId: session.payment_intent as string,
    baseAmount: totalAmount,
    currency,
    gstBreakdown,
  })
}

async function handleSubscriptionDeleted(event: Stripe.Event, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const subscription = event.data.object as Stripe.Subscription
  const metadata = subscription.metadata as Record<string, string>

  if (!metadata || !metadata.org_id) {
    console.error('Missing org_id in subscription metadata')
    return
  }

  const orgId = metadata.org_id
  if (!orgId) {
    console.error('Missing org_id in subscription metadata')
    return
  }

  // Downgrade to free plan at period end
  const planExpiresAt = new Date(subscription.current_period_end * 1000)

  await supabase
    .from('organizations')
    .update({
      plan: 'free',
      plan_expires_at: planExpiresAt.toISOString(),
    })
    .eq('id', orgId)
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event, supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (field: string, value: string) => unknown } } }) {
  const invoice = event.data.object as Stripe.Invoice
  const metadata = invoice.metadata as Record<string, string>

  if (!metadata || !metadata.org_id) {
    console.error('Missing org_id in invoice metadata')
    return
  }

  const orgId = metadata.org_id
  if (!orgId) {
    console.error('Missing org_id in invoice metadata')
    return
  }

  // Update plan expiry if it's a subscription renewal
  if (invoice.subscription) {
    const Stripe = (await import('stripe')).default
    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const subscription = await stripeInstance.subscriptions.retrieve(invoice.subscription as string)
    const planExpiresAt = new Date(subscription.current_period_end * 1000)

    await supabase
      .from('organizations')
      .update({
        plan_expires_at: planExpiresAt.toISOString(),
      })
      .eq('id', orgId)
  }

  // Generate invoice
  const totalAmount = invoice.amount_paid || 0
  const currency = invoice.currency?.toUpperCase() || 'USD'

  const gstBreakdown = {
    baseAmount: totalAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalAmount,
    isInterState: false,
  }

  await generateInvoice({
    orgId,
    stripePaymentId: invoice.payment_intent as string,
    baseAmount: totalAmount,
    currency,
    gstBreakdown,
  })
}

async function handleInvoicePaymentFailed(event: Stripe.Event, supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => unknown } }) {
  const invoice = event.data.object as Stripe.Invoice
  const metadata = invoice.metadata as Record<string, string>

  if (!metadata || !metadata.org_id) {
    console.error('Missing org_id in invoice metadata')
    return
  }

  const orgId = metadata.org_id
  if (!orgId) {
    console.error('Missing org_id in invoice metadata')
    return
  }

  // Create notification for org owner
  await supabase
    .from('notifications')
    .insert({
      user_id: null,
      org_id: orgId,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: `Your payment of ${invoice.currency?.toUpperCase()} ${(invoice.amount_due || 0) / 100} failed. Please try again.`,
      link: '/settings/billing',
    })
}
