import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/posts/calendar
 * Return posts within a date range for calendar view
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
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
    
    // Fetch posts within date range
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('org_id', orgId)
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate)
      .order('scheduled_at', { ascending: true })
    
    if (error) {
      throw error
    }
    
    // Group posts by date for calendar view
    const postsByDate = new Map<string, unknown[]>()
    
    for (const post of posts || []) {
      const scheduledAt = post.scheduled_at || post.created_at
      if (!scheduledAt) continue
      
      const dateStr = new Date(scheduledAt).toISOString().split('T')[0]
      if (!dateStr) continue
      
      if (!postsByDate.has(dateStr)) {
        postsByDate.set(dateStr, [])
      }
      
      const dateArray = postsByDate.get(dateStr)
      if (dateArray) {
        dateArray.push({
          id: post.id,
          content: post.content,
          status: post.status,
          platforms: post.platforms,
          scheduled_at: post.scheduled_at,
        })
      }
    }
    
    return NextResponse.json({
      posts: posts || [],
      postsByDate: Object.fromEntries(postsByDate),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar posts' },
      { status: 500 }
    )
  }
}
