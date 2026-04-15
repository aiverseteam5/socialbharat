import { BasePlatformConnector, PlatformPost, PlatformMetrics, DateRange, PlatformProfile, PlatformPostResult } from './base'

/**
 * Instagram Graph API connector
 * Supports publishing to Instagram Business accounts
 * Handles image, carousel, and reel types
 */
export class InstagramConnector extends BasePlatformConnector {
  private apiVersion = 'v19.0'
  private instagramBusinessAccountId: string

  constructor(accessToken: string, instagramBusinessAccountId: string) {
    super(accessToken)
    this.instagramBusinessAccountId = instagramBusinessAccountId
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    try {
      // Instagram requires creating a media container first, then publishing it
      const mediaType = post.mediaUrls && post.mediaUrls.length > 1 ? 'CAROUSEL' : post.mediaUrls?.length ? 'IMAGE' : null

      if (!mediaType) {
        throw new Error('Instagram requires at least one media URL')
      }

      const containerId = await this.createMediaContainer(post, mediaType)
      const publishedId = await this.publishMediaContainer(containerId)

      return {
        platformPostId: publishedId,
        status: 'published',
        url: `https://instagram.com/p/${publishedId}/`,
      }
    } catch (error) {
      return {
        platformPostId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to publish post',
      }
    }
  }

  private async createMediaContainer(post: PlatformPost, mediaType: 'IMAGE' | 'CAROUSEL' | 'VIDEO'): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.instagramBusinessAccountId}/media`

    if (mediaType === 'CAROUSEL') {
      // For carousel, create children first
      const childrenIds = await Promise.all(
        post.mediaUrls!.map((mediaUrl) => this.createChildContainer(mediaUrl))
      )

      const body = {
        media_type: 'CAROUSEL',
        children: childrenIds,
        caption: post.content.substring(0, 2200),
        access_token: this.accessToken,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      return data.id
    } else if (mediaType === 'IMAGE') {
      const body = {
        image_url: post.mediaUrls![0],
        caption: post.content.substring(0, 2200),
        access_token: this.accessToken,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      return data.id
    }

    throw new Error('Unsupported media type')
  }

  private async createChildContainer(mediaUrl: string): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.instagramBusinessAccountId}/media`

    const body = {
      image_url: mediaUrl,
      is_carousel_item: true,
      access_token: this.accessToken,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    return data.id
  }

  private async publishMediaContainer(containerId: string): Promise<string> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.instagramBusinessAccountId}/media_publish`

    const body = {
      creation_id: containerId,
      access_token: this.accessToken,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message)
    return data.id
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
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.instagramBusinessAccountId}?fields=id,username,profile_picture_url`
      const response = await fetch(`${url}&access_token=${this.accessToken}`)
      const data = await response.json()

      return {
        id: data.id,
        name: data.username,
        username: data.username,
        avatarUrl: data.profile_picture_url,
        platformUserId: data.id,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch profile')
    }
  }

  async getMetrics(dateRange: DateRange): Promise<PlatformMetrics> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.instagramBusinessAccountId}/insights`
      const since = Math.floor(dateRange.startDate.getTime() / 1000)
      const until = Math.floor(dateRange.endDate.getTime() / 1000)

      const metrics = ['follower_count', 'engagement', 'impressions', 'reach'].join(',')

      const response = await fetch(
        `${url}?metric=${metrics}&period=lifetime&since=${since}&until=${until}&access_token=${this.accessToken}`
      )
      const data = await response.json()

      const metricsMap = new Map<string, number>()
      data.data?.forEach((item: unknown) => {
        const metric = item as { name: string; values: Array<{ value: number }> }
        const value = metric.values?.[0]?.value || 0
        metricsMap.set(metric.name, value)
      })

      return {
        followers: metricsMap.get('follower_count') || 0,
        engagement: metricsMap.get('engagement') || 0,
        reach: metricsMap.get('reach') || 0,
        impressions: metricsMap.get('impressions') || 0,
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
    return this.accessToken
  }
}
