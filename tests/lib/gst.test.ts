import { describe, it, expect } from 'vitest'
import { calculateGST, paiseToRupees, rupeesToPaise } from '@/lib/gst'

describe('GST Calculator', () => {
  describe('calculateGST', () => {
    it('should calculate CGST + SGST for intra-state (same state)', () => {
      // ₹10,000 = 1,000,000 paise
      const result = calculateGST(1000000, 'Karnataka', 'Karnataka')
      
      // Base: ₹10,000
      // CGST 9%: ₹900 = 90,000 paise
      // SGST 9%: ₹900 = 90,000 paise
      // Total: ₹11,800 = 1,180,000 paise
      
      expect(result.baseAmount).toBe(1000000)
      expect(result.cgst).toBe(90000)
      expect(result.sgst).toBe(90000)
      expect(result.igst).toBe(0)
      expect(result.totalAmount).toBe(1180000)
      expect(result.isInterState).toBe(false)
    })

    it('should calculate IGST for inter-state (different state)', () => {
      const result = calculateGST(1000000, 'Maharashtra', 'Karnataka')
      
      // Base: ₹10,000
      // IGST 18%: ₹1,800 = 180,000 paise
      // Total: ₹11,800 = 1,180,000 paise
      
      expect(result.baseAmount).toBe(1000000)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.igst).toBe(180000)
      expect(result.totalAmount).toBe(1180000)
      expect(result.isInterState).toBe(true)
    })

    it('should handle case-insensitive state comparison', () => {
      const result1 = calculateGST(1000000, 'karnataka', 'KARNATAKA')
      expect(result1.isInterState).toBe(false)
      
      const result2 = calculateGST(1000000, 'MAHARASHTRA', 'karnataka')
      expect(result2.isInterState).toBe(true)
    })

    it('should handle state names with extra spaces', () => {
      const result = calculateGST(1000000, ' Karnataka ', ' Karnataka ')
      expect(result.isInterState).toBe(false)
      expect(result.cgst).toBe(90000)
    })

    it('should use integer math to avoid floating point drift', () => {
      // Test with an amount that could cause floating point issues
      const result = calculateGST(333333, 'Karnataka', 'Karnataka')
      
      // 333,333 * 0.09 = 29,999.97 → rounds to 30,000
      expect(result.cgst).toBe(30000)
      expect(result.sgst).toBe(30000)
      expect(Number.isInteger(result.totalAmount)).toBe(true)
    })

    it('should handle zero amount', () => {
      const result = calculateGST(0, 'Karnataka', 'Karnataka')
      
      expect(result.baseAmount).toBe(0)
      expect(result.cgst).toBe(0)
      expect(result.sgst).toBe(0)
      expect(result.igst).toBe(0)
      expect(result.totalAmount).toBe(0)
    })

    it('should handle large amounts', () => {
      // ₹1,00,000 = 10,000,000 paise
      const result = calculateGST(10000000, 'Karnataka', 'Karnataka')
      
      expect(result.baseAmount).toBe(10000000)
      expect(result.cgst).toBe(900000)
      expect(result.sgst).toBe(900000)
      expect(result.totalAmount).toBe(11800000)
    })
  })

  describe('paiseToRupees', () => {
    it('should convert paise to rupees', () => {
      expect(paiseToRupees(100)).toBe(1)
      expect(paiseToRupees(10000)).toBe(100)
      expect(paiseToRupees(1180000)).toBe(11800)
    })

    it('should handle fractional paise', () => {
      expect(paiseToRupees(150)).toBe(1.5)
      expect(paiseToRupees(99)).toBe(0.99)
    })
  })

  describe('rupeesToPaise', () => {
    it('should convert rupees to paise', () => {
      expect(rupeesToPaise(1)).toBe(100)
      expect(rupeesToPaise(100)).toBe(10000)
      expect(rupeesToPaise(11800)).toBe(1180000)
    })

    it('should round to integer', () => {
      expect(rupeesToPaise(1.5)).toBe(150)
      expect(rupeesToPaise(0.99)).toBe(99)
    })
  })
})
