import { describe, it, expect, vi } from 'vitest'
import { getUpcomingFestivals, getFestivalById, getFestivalsByDate } from '@/lib/festivals'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
}))

describe('festivals', () => {
  describe('getUpcomingFestivals', () => {
    it('should return festivals within date range', async () => {
      const result = await getUpcomingFestivals(14)
      
      expect(result).toEqual([])
    })
  })
  
  describe('getFestivalById', () => {
    it('should return festival by ID', async () => {
      const result = await getFestivalById('test-id')
      
      expect(result).toBeNull()
    })
  })
  
  describe('getFestivalsByDate', () => {
    it('should return festivals for specific date', async () => {
      const result = await getFestivalsByDate('2024-01-01')
      
      expect(result).toEqual([])
    })
  })
})
