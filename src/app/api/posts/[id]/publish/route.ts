import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { getPlatformConnector } from '@/lib/platforms'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/posts/[id]/publish
 * Publish post immediately to selected platforms
 */
export async function POST(
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
    
    const postId = id
    
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
    
    // Fetch post
    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .eq('org_id', orgId)
      .single()
    
    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    
    // Fetch social profiles for platforms
    const { data: profiles } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('org_id', orgId)
      .in('id', post.platforms)
    
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'No connected profiles found' }, { status: 400 })
    }
    
    // Publish to each platform
    const publishResults: Record<string, { platformPostId: string; url?: string; status: string; error?: string }> = {}
    let overallStatus: 'published' | 'failed' | 'partially_failed' = 'published'
    let successCount = 0
    
    for (const profile of profiles) {
      try {
        const decryptedToken = decrypt(profile.access_token)
        const connector = getPlatformConnector(profile.platform as 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'whatsapp', {
          accessToken: decryptedToken,
          platformUserId: profile.platform_user_id,
          organizationUrn: profile.metadata?.organization_urn as string | undefined,
          personUrn: profile.metadata?.person_urn as string | undefined,
          phoneNumberId: profile.metadata?.phone_number_id as string | undefined,
        })
        
        // Use platform-specific content if available, otherwise use default
        const content = post.content_json?.platform_overrides?.[profile.platform]?.text || post.content
        const mediaUrls = post.content_json?.platform_overrides?.[profile.platform]?.media_urls || post.media_urls
        
        const result = await connector.publishPost({
          content,
          mediaUrls,
        })
        
        publishResults[profile.id] = {
          platformPostId: result.platformPostId,
          url: result.url,
          status: result.status,
        }
        
        if (result.status === 'published') {
          successCount++
        } else {
          overallStatus = 'partially_failed'
        }
      } catch (error) {
        publishResults[profile.id] = {
          platformPostId: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        overallStatus = 'partially_failed'
      }
    }
    
    if (successCount === 0) {
      overallStatus = 'failed'
    }
    
    // Update post with results
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        status: overallStatus,
        published_at: new Date(),
        publish_results: publishResults,
        updated_at: new Date(),
      })
      .eq('id', postId)
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      status: overallStatus,
      results: publishResults,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish post' },
      { status: 500 }
    )
  }
}
