import { describe, it, expect } from 'vitest'
import { createPostSchema } from '@/types/schemas'

describe('posts API', () => {
  it('should have post schema validation', () => {
    const validData = {
      content: 'Test post',
      platforms: ['123e4567-e89b-12d3-a456-426614174000'],
      status: 'draft',
    }
    
    const result = createPostSchema.parse(validData)
    
    expect(result).toMatchObject({
      content: 'Test post',
      platforms: ['123e4567-e89b-12d3-a456-426614174000'],
      status: 'draft',
    })
  })
})
