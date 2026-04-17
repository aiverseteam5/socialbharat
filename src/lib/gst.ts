/**
 * GST Calculator for Indian SaaS
 * 
 * GST rate: 18% for SaaS services
 * - Intra-state (same state): CGST 9% + SGST 9%
 * - Inter-state (different state): IGST 18%
 * 
 * All amounts in paise (integer math, no floating point)
 */

export interface GSTBreakdown {
  baseAmount: number // in paise
  cgst: number // in paise
  sgst: number // in paise
  igst: number // in paise
  totalAmount: number // in paise
  isInterState: boolean
}

const GST_RATE = 18 // 18%
const HALF_GST_RATE = 9 // 9% for CGST/SGST split
const COMPANY_GST_STATE = process.env.COMPANY_GST_STATE || 'Karnataka'

/**
 * Calculate GST breakdown
 * @param baseAmountPaise - Base amount in paise (integer)
 * @param customerState - Customer's state (e.g., 'Karnataka', 'Maharashtra')
 * @param companyState - Company's GST state (default: from env or 'Karnataka')
 * @returns GST breakdown with all amounts in paise
 */
export function calculateGST(
  baseAmountPaise: number,
  customerState: string,
  companyState: string = COMPANY_GST_STATE
): GSTBreakdown {
  // Normalize state names for comparison (case-insensitive, trim)
  const normalizedCustomerState = customerState.toLowerCase().trim()
  const normalizedCompanyState = companyState.toLowerCase().trim()

  const isInterState = normalizedCustomerState !== normalizedCompanyState

  let cgst = 0
  let sgst = 0
  let igst = 0

  if (isInterState) {
    // Inter-state: IGST 18%
    igst = Math.round((baseAmountPaise * GST_RATE) / 100)
  } else {
    // Intra-state: CGST 9% + SGST 9%
    cgst = Math.round((baseAmountPaise * HALF_GST_RATE) / 100)
    sgst = Math.round((baseAmountPaise * HALF_GST_RATE) / 100)
  }

  const totalAmount = baseAmountPaise + cgst + sgst + igst

  return {
    baseAmount: baseAmountPaise,
    cgst,
    sgst,
    igst,
    totalAmount,
    isInterState,
  }
}

/**
 * Convert paise to rupees (for display purposes)
 * @param paise - Amount in paise
 * @returns Amount in rupees (float)
 */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/**
 * Convert rupees to paise (for payment processing)
 * @param rupees - Amount in rupees
 * @returns Amount in paise (integer)
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}
