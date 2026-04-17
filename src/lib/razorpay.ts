import Razorpay from 'razorpay'
import crypto from 'crypto'

/**
 * Razorpay client initialization
 * RAZORPAY_KEY_SECRET must NEVER appear in any client-side file
 */

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export interface CreateOrderParams {
  amount: number // in paise (integer)
  currency: string // e.g., 'INR'
  orgId: string
  receipt?: string
  notes?: Record<string, string>
}

export interface RazorpayOrder {
  id: string
  entity: string
  amount: number | string
  amount_paid: number | string
  amount_due: number | string
  currency: string
  receipt?: string
  offer_id?: string | null
  status: string
  attempts: number
  notes?: Record<string, string | number | null>
  created_at: number
}

/**
 * Create a Razorpay order for payment
 */
export async function createOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
  const { amount, currency, orgId, receipt, notes } = params

  const options = {
    amount,
    currency,
    receipt: receipt || `order_${orgId}_${Date.now()}`,
    notes: {
      org_id: orgId,
      ...(notes || {}),
    },
  }

  try {
    const order = await razorpayInstance.orders.create(options)
    return order as RazorpayOrder
  } catch (error) {
    console.error('Razorpay order creation failed:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to create Razorpay order')
  }
}

/**
 * Verify Razorpay payment signature
 * Used after payment completion to ensure authenticity
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  return generatedSignature === signature
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  webhookSecret: string,
  payload: string,
  signature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  return expectedSignature === signature
}
