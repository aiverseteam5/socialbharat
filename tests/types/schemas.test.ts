import { describe, it, expect } from 'vitest'
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  idParamSchema,
} from '@/types/schemas'

describe('Zod Schemas', () => {
  describe('sendOtpSchema', () => {
    it('should accept valid Indian phone numbers', () => {
      const result = sendOtpSchema.parse({ phone: '+919876543210' })
      expect(result.phone).toBe('+919876543210')
    })

    it('should reject invalid phone numbers', () => {
      expect(() => sendOtpSchema.parse({ phone: '9876543210' })).toThrow()
      expect(() => sendOtpSchema.parse({ phone: '+915876543210' })).toThrow() // Starts with 5
      expect(() => sendOtpSchema.parse({ phone: '+91987654321' })).toThrow() // Too short
      expect(() => sendOtpSchema.parse({ phone: '+9198765432101' })).toThrow() // Too long
    })
  })

  describe('verifyOtpSchema', () => {
    it('should accept valid phone and 6-digit OTP', () => {
      const result = verifyOtpSchema.parse({ phone: '+919876543210', otp: '123456' })
      expect(result.phone).toBe('+919876543210')
      expect(result.otp).toBe('123456')
    })

    it('should reject non-6-digit OTP', () => {
      expect(() => verifyOtpSchema.parse({ phone: '+919876543210', otp: '12345' })).toThrow('OTP must be exactly 6 digits')
      expect(() => verifyOtpSchema.parse({ phone: '+919876543210', otp: '1234567' })).toThrow('OTP must be exactly 6 digits')
    })

    it('should reject non-numeric OTP', () => {
      expect(() => verifyOtpSchema.parse({ phone: '+919876543210', otp: 'abcdef' })).toThrow('OTP must be numeric')
    })

    it('should reject invalid phone numbers', () => {
      expect(() => verifyOtpSchema.parse({ phone: '9876543210', otp: '123456' })).toThrow()
    })
  })

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.parse({
        email: 'test@example.com',
        password: 'Password123',
        full_name: 'John Doe',
      })
      expect(result.email).toBe('test@example.com')
      expect(result.full_name).toBe('John Doe')
    })

    it('should reject invalid email', () => {
      expect(() => registerSchema.parse({ email: 'invalid', password: 'Password123', full_name: 'John Doe' })).toThrow()
    })

    it('should reject weak password', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'weak', full_name: 'John Doe' })).toThrow()
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'password', full_name: 'John Doe' })).toThrow('uppercase')
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'Password', full_name: 'John Doe' })).toThrow('number')
    })

    it('should reject name that is too short', () => {
      expect(() => registerSchema.parse({ email: 'test@example.com', password: 'Password123', full_name: 'J' })).toThrow()
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.parse({ email: 'test@example.com', password: 'password123' })
      expect(result.email).toBe('test@example.com')
      expect(result.password).toBe('password123')
    })

    it('should reject invalid email', () => {
      expect(() => loginSchema.parse({ email: 'invalid', password: 'password' })).toThrow()
    })

    it('should reject empty password', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow()
    })
  })

  describe('createOrgSchema', () => {
    it('should accept valid organization data', () => {
      const result = createOrgSchema.parse({
        name: 'Acme Corporation',
        industry: 'Technology',
        team_size: '11-25',
        preferred_language: 'en',
      })
      expect(result.name).toBe('Acme Corporation')
      expect(result.preferred_language).toBe('en')
    })

    it('should accept minimal required fields', () => {
      const result = createOrgSchema.parse({ name: 'Test Org' })
      expect(result.name).toBe('Test Org')
      expect(result.preferred_language).toBe('en')
    })

    it('should reject name that is too short', () => {
      expect(() => createOrgSchema.parse({ name: 'A' })).toThrow()
    })

    it('should reject invalid team_size', () => {
      expect(() => createOrgSchema.parse({ name: 'Test', team_size: 'invalid' })).toThrow()
    })
  })

  describe('updateOrgSchema', () => {
    it('should accept valid GST number', () => {
      const result = updateOrgSchema.parse({
        gst_number: '22AAAAA0000A1Z5',
      })
      expect(result.gst_number).toBe('22AAAAA0000A1Z5')
    })

    it('should reject invalid GST number format', () => {
      expect(() => updateOrgSchema.parse({ gst_number: 'invalid' })).toThrow('Invalid GSTIN format')
    })

    it('should accept valid billing email', () => {
      const result = updateOrgSchema.parse({
        billing_email: 'billing@example.com',
      })
      expect(result.billing_email).toBe('billing@example.com')
    })

    it('should reject invalid billing email', () => {
      expect(() => updateOrgSchema.parse({ billing_email: 'invalid' })).toThrow()
    })
  })

  describe('inviteMemberSchema', () => {
    it('should accept email invitation', () => {
      const result = inviteMemberSchema.parse({
        email: 'test@example.com',
        role: 'admin',
      })
      expect(result.email).toBe('test@example.com')
      expect(result.role).toBe('admin')
    })

    it('should accept phone invitation', () => {
      const result = inviteMemberSchema.parse({
        phone: '+919876543210',
        role: 'viewer',
      })
      expect(result.phone).toBe('+919876543210')
      expect(result.role).toBe('viewer')
    })

    it('should reject when neither email nor phone is provided', () => {
      expect(() => inviteMemberSchema.parse({ role: 'admin' })).toThrow('Either email or phone is required')
    })

    it('should reject invalid role', () => {
      expect(() => inviteMemberSchema.parse({ email: 'test@example.com', role: 'owner' })).toThrow()
    })
  })

  describe('updateMemberRoleSchema', () => {
    it('should accept valid role', () => {
      const result = updateMemberRoleSchema.parse({ role: 'editor' })
      expect(result.role).toBe('editor')
    })

    it('should reject invalid role', () => {
      expect(() => updateMemberRoleSchema.parse({ role: 'owner' })).toThrow()
    })
  })

  describe('idParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = idParamSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should reject invalid UUID', () => {
      expect(() => idParamSchema.parse({ id: 'not-a-uuid' })).toThrow('Invalid ID format')
    })
  })
})
