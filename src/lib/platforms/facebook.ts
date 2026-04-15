import { BasePlatformConnector, PlatformPost, PlatformMetrics, DateRange, PlatformProfile, PlatformPostResult } from './base'

/**
 * Facebook Graph API connector
 * Supports publishing to Facebook Pages
 */
export class FacebookConnector extends BasePlatformConnector {
  private apiVersion = 'v19.0'
  private pageId: string

  constructor(accessToken: string, pageId: string) {
    super(accessToken)
    this.pageId = pageId
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/feed`
      
      const body: Record<string, unknown> = {
        message: post.content,
        access_token: this.accessToken,
      }

      if (post.mediaUrls && post.mediaUrls.length > 0) {
        // For Facebook, we upload media first then attach to post
        // This is a simplified version - production would need proper media upload handling
        const attachedMedia = await Promise.all(
          post.mediaUrls.map(async (mediaUrl) => {
            const uploadUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/photos`
            const response = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: mediaUrl,
                published: false,
                access_token: this.accessToken,
              }),
            })
            const data = await response.json()
            return data.id
          })
        )
        body.attached_media = attachedMedia.map((id) => ({ media_fbid: id }))
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message)
      }

      return {
        platformPostId: data.id,
        status: 'published',
        url: `https://facebook.com/${data.id}`,
      }
    } catch (error) {
      return {
        platformPostId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to publish post',
      }
    }
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${platformPostId}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: this.accessToken }),
      })

      const data = await response.json()
      return data.success === true
    } catch {
      return false
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}?fields=id,name,picture`
      const response = await fetch(`${url}&access_token=${this.accessToken}`)
      const data = await response.json()

      return {
        id: data.id,
        name: data.name,
        username: data.username,
        avatarUrl: data.picture?.data?.url,
        platformUserId: data.id,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch profile')
    }
  }

  async getMetrics(dateRange: DateRange): Promise<PlatformMetrics> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.pageId}/insights`
      const since = Math.floor(dateRange.startDate.getTime() / 1000)
      const until = Math.floor(dateRange.endDate.getTime() / 1000)

      const metrics = [
        'page_follows',
        'page_post_engagements',
        'page_impressions',
        'page_reach',
      ].join(',')

      const response = await fetch(
        `${url}?metric=${metrics}&since=${since}&until=${until}&access_token=${this.accessToken}`
      )
      const data = await response.json()

      const metricsMap = new Map<string, number>()
      data.data?.forEach((item: unknown) => {
        const metric = item as { name: string; values: Array<{ value: number }> }
        const value = metric.values?.[0]?.value || 0
        metricsMap.set(metric.name, value)
      })

      return {
        followers: metricsMap.get('page_follows') || 0,
        engagement: metricsMap.get('page_post_engagements') || 0,
        reach: metricsMap.get('page_reach') || 0,
        impressions: metricsMap.get('page_impressions') || 0,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch metrics')
    }
  }

  async checkTokenHealth(): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/me`
      const response = await fetch(`${url}?access_token=${this.accessToken}`)
      const data = await response.json()
      return !data.error
    } catch {
      return false
    }
  }

  async refreshToken(): Promise<string> {
    // Facebook long-lived tokens can be refreshed, but for now return existing token
    // Production implementation would use the token refresh endpoint
    return this.accessToken
  }
}
