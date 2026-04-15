import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/connectors/profiles/[id]
 * Disconnect a social profile by removing it from the database
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    
    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }
    
    const orgId = orgMember.org_id
    
    // Verify the profile belongs to the user's organization
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('org_id')
      .eq('id', id)
      .single()
    
    if (!profile || profile.org_id !== orgId) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    
    // Delete the profile
    const { error } = await supabase
      .from('social_profiles')
      .delete()
      .eq('id', id)
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect profile' },
      { status: 500 }
    )
  }
}
