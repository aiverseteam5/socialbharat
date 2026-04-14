import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { idParamSchema } from '@/types/schemas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    
    const { id } = await params
    const validationResult = idParamSchema.safeParse({ id })
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid organization ID' },
        { status: 400 }
      )
    }
    
    const { id: orgId } = validationResult.data
    
    // Verify membership
    await requireRole(orgId, ['owner', 'admin', 'editor', 'viewer'])
    
    const supabase = await createClient()
    
    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()
    
    if (error || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ organization: org })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('redirect')) {
        throw error
      }
      if (error.message.includes('not a member') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    console.error('Get organization error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}
