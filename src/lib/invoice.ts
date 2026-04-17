import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import { type GSTBreakdown } from "./gst";

/**
 * GST-compliant invoice generation.
 * HSN/SAC code: 998314 (online information / SaaS services).
 *
 * All monetary columns are stored in paise (integer). The caller passes
 * the already-calculated GST breakdown from src/lib/gst.ts.
 */

export interface InvoiceData {
  orgId: string;
  razorpayPaymentId?: string;
  stripePaymentId?: string;
  baseAmount: number; // paise
  currency: string;
  gstBreakdown: GSTBreakdown;
  gstNumber?: string;
  billingState?: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  org_id: string;
  razorpay_payment_id: string | null;
  stripe_payment_id: string | null;
  base_amount: number;
  currency: string;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
  gst_number: string | null;
  billing_state: string | null;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

/**
 * Pull the next invoice number atomically via the Postgres function
 * `next_invoice_number()` created in migration 00005. Backed by a sequence,
 * so two concurrent webhooks can never receive the same value.
 */
async function nextInvoiceNumber(): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("next_invoice_number");

  if (error || typeof data !== "string") {
    throw new Error(
      `Failed to generate invoice number: ${error?.message ?? "unknown"}`,
    );
  }
  return data;
}

/**
 * Insert a paid invoice record. Uses the service-role client so that
 * server-side webhooks can write regardless of RLS.
 */
export async function generateInvoice(
  data: InvoiceData,
): Promise<InvoiceRecord> {
  const supabase = createServiceClient();
  const {
    orgId,
    razorpayPaymentId,
    stripePaymentId,
    baseAmount,
    currency,
    gstBreakdown,
    gstNumber,
    billingState,
  } = data;

  const invoiceNumber = await nextInvoiceNumber();

  const invoiceData = {
    org_id: orgId,
    invoice_number: invoiceNumber,
    razorpay_payment_id: razorpayPaymentId || null,
    stripe_payment_id: stripePaymentId || null,
    base_amount: baseAmount,
    currency,
    cgst: gstBreakdown.cgst,
    sgst: gstBreakdown.sgst,
    igst: gstBreakdown.igst,
    total_amount: gstBreakdown.totalAmount,
    gst_number: gstNumber || null,
    billing_state: billingState || null,
    status: "paid",
    pdf_url: null,
  };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert(invoiceData)
    .select()
    .single();

  if (error) {
    logger.error("Invoice generation failed", error, { orgId, invoiceNumber });
    throw new Error(error.message);
  }

  return invoice as InvoiceRecord;
}

export async function getInvoiceById(
  invoiceId: string,
): Promise<InvoiceRecord | null> {
  const supabase = createServiceClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error) {
    logger.error("Failed to fetch invoice", error, { invoiceId });
    return null;
  }

  return invoice as InvoiceRecord;
}

export async function listInvoicesForOrg(
  orgId: string,
  limit = 20,
  offset = 0,
): Promise<InvoiceRecord[]> {
  const supabase = createServiceClient();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("Failed to fetch invoices", error, { orgId });
    return [];
  }

  return (invoices || []) as InvoiceRecord[];
}
