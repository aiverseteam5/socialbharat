import Razorpay from "razorpay";
import crypto from "crypto";
import { logger } from "@/lib/logger";

/**
 * Razorpay client initialization.
 * RAZORPAY_KEY_SECRET must NEVER appear in any client-side file.
 */

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export interface CreateOrderParams {
  amount: number; // paise (integer)
  currency: string; // e.g., 'INR'
  orgId: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number | string;
  amount_paid: number | string;
  amount_due: number | string;
  currency: string;
  receipt?: string;
  offer_id?: string | null;
  status: string;
  attempts: number;
  notes?: Record<string, string | number | null>;
  created_at: number;
}

export async function createOrder(
  params: CreateOrderParams,
): Promise<RazorpayOrder> {
  const { amount, currency, orgId, receipt, notes } = params;

  const options = {
    amount,
    currency,
    receipt: receipt || `order_${orgId}_${Date.now()}`,
    notes: {
      org_id: orgId,
      ...(notes || {}),
    },
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return order as RazorpayOrder;
  } catch (error) {
    logger.error("Razorpay order creation failed", error, { orgId });
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to create Razorpay order",
    );
  }
}

/**
 * Verify the signature Razorpay returns to the client after a successful
 * payment — HMAC-SHA256 over "orderId|paymentId" with RAZORPAY_KEY_SECRET.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeCompare(generatedSignature, signature);
}

/**
 * Verify a Razorpay webhook signature — HMAC-SHA256 over the raw request
 * body with RAZORPAY_WEBHOOK_SECRET.
 */
export function verifyWebhookSignature(
  webhookSecret: string,
  payload: string,
  signature: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return timingSafeCompare(expectedSignature, signature);
}

/**
 * Cancel an active Razorpay subscription. Razorpay v2 SDK exposes
 * subscriptions.cancel(subscriptionId, cancelAtCycleEnd).
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true,
): Promise<{ status: string; current_end: number | null }> {
  const sub = await razorpayInstance.subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd,
  );
  return {
    status: sub.status,
    current_end: (sub as { current_end?: number }).current_end ?? null,
  };
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
