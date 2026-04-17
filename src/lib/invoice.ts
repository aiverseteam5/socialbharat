import { createClient } from '@/lib/supabase/server'
import { type GSTBreakdown } from './gst'

/**
 * GST-compliant invoice generation
 * HSN/SAC code: 998314 (SaaS services)
 */

export interface InvoiceData {
  orgId: string
  razorpayPaymentId?: string
  stripePaymentId?: string
  baseAmount: number // in paise
  currency: string
  gstBreakdown: GSTBreakdown
  gstNumber?: string
  billingState?: string
}

export interface InvoiceRecord {
  id: string
  invoice_number: string
  org_id: string
  razorpay_payment_id: string | null
  stripe_payment_id: string | null
  base_amount: number
  currency: string
  cgst: number
  sgst: number
  igst: number
  total_amount: number
  gst_number: string | null
  billing_state: string | null
  status: string
  pdf_url: string | null
  created_at: string
}

/**
 * Generate sequential invoice number
 * Format: SB-YYYY-XXXX (e.g., SB-2025-0001)
 */
async function generateInvoiceNumber(): Promise<string> {
  const supabase = await createClient()
  const year = new Date().getFullYear()

  // Get the last invoice number for this year
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .ilike('invoice_number', `SB-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let sequence = 1
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoice_number.split('-')[2], 10)
    sequence = lastSequence + 1
  }

  const sequenceStr = sequence.toString().padStart(4, '0')
  return `SB-${year}-${sequenceStr}`
}

/**
 * Generate GST-compliant invoice
 * Creates invoice record in database with sequential invoice number
 */
export async function generateInvoice(
  data: InvoiceData
): Promise<InvoiceRecord> {
  const supabase = await createClient()
  const {
    orgId,
    razorpayPaymentId,
    stripePaymentId,
    baseAmount,
    currency,
    gstBreakdown,
    gstNumber,
    billingState,
  } = data

  const invoiceNumber = await generateInvoiceNumber()

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
    status: 'paid',
    pdf_url: null, // PDF generation can be added later
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(invoiceData)
    .select()
    .single()

  if (error) {
    console.error('Invoice generation failed:', error)
    throw new Error(error.message)
  }

  return invoice
}

/**
 * Get invoice details by ID
 */
export async function getInvoiceById(invoiceId: string): Promise<InvoiceRecord | null> {
  const supabase = await createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single()

  if (error) {
    console.error('Failed to fetch invoice:', error)
    return null
  }

  return invoice
}

/**
 * List invoices for an organization
 */
export async function listInvoicesForOrg(
  orgId: string,
  limit: number = 20,
  offset: number = 0
): Promise<InvoiceRecord[]> {
  const supabase = await createClient()

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to fetch invoices:', error)
    return []
  }

  return invoices || []
}
