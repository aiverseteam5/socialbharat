import { createClient } from './supabase/server'
import { decrypt } from './encryption'
import { getPlatformConnector } from './platforms'

/**
 * Process scheduled posts that are due for publishing
 * Queries posts where status='scheduled' AND scheduled_at <= NOW()
 * Publishes each one and updates status accordingly
 */
export async function processScheduledPosts(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const supabase = await createClient()
  
  // Fetch all scheduled posts that are due
  const now = new Date()
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
  
  if (error) {
    console.error('Error fetching scheduled posts:', error)
    return { processed: 0, succeeded: 0, failed: 0 }
  }
  
  if (!posts || posts.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }
  
  let processed = 0
  let succeeded = 0
  let failed = 0
  
  for (const post of posts) {
    processed++
    
    try {
      // Fetch social profiles for platforms
      const { data: profiles } = await supabase
        .from('social_profiles')
        .select('*')
        .eq('org_id', post.org_id)
        .in('id', post.platforms)
      
      if (!profiles || profiles.length === 0) {
        console.error(`No profiles found for post ${post.id}`)
        await markPostFailed(supabase, post.id, 'No connected profiles found')
        failed++
        continue
      }
      
      // Publish to each platform
      const publishResults: Record<string, { platformPostId: string; url?: string; status: string; error?: string }> = {}
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
          }
        } catch (error) {
          publishResults[profile.id] = {
            platformPostId: '',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      }
      
      // Determine overall status
      let overallStatus: 'published' | 'failed' | 'partially_failed' = 'published'
      if (successCount === 0) {
        overallStatus = 'failed'
      } else if (successCount < profiles.length) {
        overallStatus = 'partially_failed'
      }
      
      // Update post with results
      const { error: updateError } = await supabase
        .from('posts')
        .update({
          status: overallStatus,
          published_at: now,
          publish_results: publishResults,
          updated_at: now,
        })
        .eq('id', post.id)
      
      if (updateError) {
        throw updateError
      }
      
      if (overallStatus === 'published') {
        succeeded++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`Error processing post ${post.id}:`, error)
      await markPostFailed(supabase, post.id, error instanceof Error ? error.message : 'Unknown error')
      failed++
    }
  }
  
  return { processed, succeeded, failed }
}

/**
 * Mark a post as failed with error message
 */
async function markPostFailed(supabase: Awaited<ReturnType<typeof createClient>>, postId: string, errorMessage: string): Promise<void> {
  await supabase
    .from('posts')
    .update({
      status: 'failed',
      publish_results: {
        error: errorMessage,
      },
      updated_at: new Date(),
    })
    .eq('id', postId)
}
