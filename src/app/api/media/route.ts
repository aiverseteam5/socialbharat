import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/media
 * List media assets for current organization with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    
    // Parse filters
    const folder = searchParams.get('folder')
    const fileType = searchParams.get('file_type')
    const tags = searchParams.get('tags')?.split(',')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit
    
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
    
    let query = supabase
      .from('media_assets')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
    
    if (folder) {
      query = query.eq('folder', folder)
    }
    
    if (fileType) {
      query = query.eq('file_type', fileType)
    }
    
    if (tags && tags.length > 0) {
      query = query.contains('tags', tags)
    }
    
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    const { data: mediaAssets, error, count } = await query
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      mediaAssets: mediaAssets || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch media assets' },
      { status: 500 }
    )
  }
}
