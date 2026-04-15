import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUser, getSession, requireAuth, requireRole, getCurrentOrg, hasRole } from '@/lib/auth'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('Auth Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getUser', () => {
    it('should return user when session exists', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getUser()
      expect(result).toEqual(mockUser)
    })

    it('should return null when no session', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getUser()
      expect(result).toBeNull()
    })
  })

  describe('getSession', () => {
    it('should return session when exists', async () => {
      const mockSession = { access_token: 'abc', user: { id: '123' } }
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: mockSession } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getSession()
      expect(result).toEqual(mockSession)
    })

    it('should return null when no session', async () => {
      const mockSupabase = {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getSession()
      expect(result).toBeNull()
    })
  })

  describe('requireAuth', () => {
    it('should return user when authenticated', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await requireAuth()
      expect(result).toEqual(mockUser)
      expect(redirect).not.toHaveBeenCalled()
    })

    it('should redirect to /login when not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      // redirect is a special function that doesn't throw in tests
      // We just verify it was called
      await requireAuth()
      expect(redirect).toHaveBeenCalledWith('/login')
    })
  })

  describe('requireRole', () => {
    it('should return user and role when user has required role', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockMember = { role: 'admin' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await requireRole('org-123', ['admin', 'owner'])
      expect(result).toEqual({ user: mockUser, role: 'admin' })
    })

    it('should throw error when user not a member', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      await expect(requireRole('org-123', ['admin'])).rejects.toThrow('You are not a member of this organization')
    })

    it('should throw error when user lacks required role', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockMember = { role: 'viewer' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      await expect(requireRole('org-123', ['admin', 'owner'])).rejects.toThrow('You do not have permission to perform this action')
    })
  })

  describe('getCurrentOrg', () => {
    it('should return org when user is a member', async () => {
      const mockMember = {
        org_id: 'org-123',
        role: 'admin',
        organizations: { id: 'org-123', name: 'Test Org' },
      }
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getCurrentOrg('user-123')
      expect(result).toEqual(mockMember)
    })

    it('should return null when user has no org', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await getCurrentOrg('user-123')
      expect(result).toBeNull()
    })
  })

  describe('hasRole', () => {
    it('should return true when user has role', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockMember = { role: 'admin' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await hasRole('org-123', 'admin')
      expect(result).toBe(true)
    })

    it('should return false when user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await hasRole('org-123', 'admin')
      expect(result).toBe(false)
    })

    it('should return false when user has different role', async () => {
      const mockUser = { id: '123', email: 'test@example.com' }
      const mockMember = { role: 'viewer' }
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockMember, error: null }),
      }
      vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

      const result = await hasRole('org-123', 'admin')
      expect(result).toBe(false)
    })
  })
})
