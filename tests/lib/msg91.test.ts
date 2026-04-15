import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendOtp, verifyOtp } from '@/lib/msg91'

global.fetch = vi.fn()

describe('MSG91 Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MSG91_AUTH_KEY = 'test-auth-key'
    process.env.MSG91_TEMPLATE_ID = 'test-template-id'
  })

  describe('sendOtp', () => {
    it('should send OTP via MSG91 API when auth key is set', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ type: 'success', message: 'OTP sent successfully' }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await sendOtp('+919876543210')

      expect(fetch).toHaveBeenCalledWith('https://api.msg91.com/api/v5/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': 'test-auth-key',
        },
        body: JSON.stringify({
          template_id: 'test-template-id',
          mobile: '+919876543210',
          otp_length: 6,
        }),
      })
      expect(result).toEqual({ message: 'OTP sent successfully', expiresIn: 300 })
    })

    it('should use mock OTP when MSG91_AUTH_KEY is not set', async () => {
      delete process.env.MSG91_AUTH_KEY

      const result = await sendOtp('+919876543210')

      expect(fetch).not.toHaveBeenCalled()
      expect(result).toEqual({ message: 'OTP sent (development mode)', expiresIn: 300 })
    })

    it('should throw error when MSG91 API fails', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ type: 'error', message: 'Invalid phone number' }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      await expect(sendOtp('+919876543210')).rejects.toThrow('Failed to send OTP. Please try again.')
    })

    it('should throw error when fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      await expect(sendOtp('+919876543210')).rejects.toThrow('Failed to send OTP. Please try again.')
    })
  })

  describe('verifyOtp', () => {
    it('should verify OTP via MSG91 API when auth key is set', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ type: 'success', message: 'OTP verified successfully' }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await verifyOtp('+919876543210', '123456')

      expect(fetch).toHaveBeenCalledWith('https://api.msg91.com/api/v5/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': 'test-auth-key',
        },
        body: JSON.stringify({
          mobile: '+919876543210',
          otp: '123456',
        }),
      })
      expect(result).toEqual({ valid: true, message: 'OTP verified successfully' })
    })

    it('should use mock OTP verification when MSG91_AUTH_KEY is not set', async () => {
      delete process.env.MSG91_AUTH_KEY

      const result = await verifyOtp('+919876543210', '123456')

      expect(fetch).not.toHaveBeenCalled()
      expect(result).toEqual({ valid: true, message: 'OTP verified successfully (development mode)' })
    })

    it('should return invalid for wrong mock OTP', async () => {
      delete process.env.MSG91_AUTH_KEY

      const result = await verifyOtp('+919876543210', '000000')

      expect(result).toEqual({ valid: false, message: 'Invalid OTP' })
    })

    it('should return invalid when MSG91 API returns error', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ type: 'error', message: 'Invalid OTP' }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const result = await verifyOtp('+919876543210', '000000')

      expect(result).toEqual({ valid: false, message: 'Invalid OTP' })
    })

    it('should throw error when fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const result = await verifyOtp('+919876543210', '123456')

      expect(result).toEqual({ valid: false, message: 'Failed to verify OTP. Please try again.' })
    })
  })
})
