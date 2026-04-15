import { BasePlatformConnector, PlatformPost, PlatformMetrics, DateRange, PlatformProfile, PlatformPostResult } from './base'

/**
 * LinkedIn API connector
 * Supports publishing to LinkedIn Pages via UGC Posts API
 */
export class LinkedInConnector extends BasePlatformConnector {
  private apiVersion = 'v2'
  private personUrn: string
  private organizationUrn: string

  constructor(accessToken: string, personUrn: string, organizationUrn: string) {
    super(accessToken)
    this.personUrn = personUrn
    this.organizationUrn = organizationUrn
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    try {
      const url = `https://api.linkedin.com/${this.apiVersion}/ugcPosts`

      const body: Record<string, unknown> = {
        author: this.organizationUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: post.content.substring(0, 3000),
            },
            shareMediaCategory: post.mediaUrls && post.mediaUrls.length > 0 ? 'IMAGE' : 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
      }

      if (post.mediaUrls && post.mediaUrls.length > 0) {
        // Upload media first, then attach to post
        const mediaUrl = post.mediaUrls[0]
        if (!mediaUrl) {
          throw new Error('Media URL is required')
        }
        const mediaUrn = await this.uploadMedia(mediaUrl)
        const specificContent = body.specificContent as Record<string, unknown>
        const shareContent = specificContent['com.linkedin.ugc.ShareContent'] as Record<string, unknown>
        specificContent['com.linkedin.ugc.ShareContent'] = {
          ...shareContent,
          media: [
            {
              status: 'READY',
              description: {
                text: post.content.substring(0, 100),
              },
              media: mediaUrn,
              title: {
                text: 'Post image',
              },
            },
          ],
        }
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.errorCode) {
        throw new Error(data.message || 'Failed to publish post')
      }

      return {
        platformPostId: data.id,
        status: 'published',
      }
    } catch (error) {
      return {
        platformPostId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to publish post',
      }
    }
  }

  private async uploadMedia(mediaUrl: string): Promise<string> {
    try {
      const registerUrl = `https://api.linkedin.com/${this.apiVersion}/assets?action=registerUpload`
      
      const registerBody = {
        registerUploadRequest: {
          owner: this.organizationUrn,
          recipes: [
            {
              'com.linkedin.digitalmedia.mediaartifact.MediaArtifactRecipe': {
                mediaArtifactType: 'IMAGE',
              },
            },
          ],
        },
      }

      const registerResponse = await fetch(registerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(registerBody),
      })

      const registerData = await registerResponse.json()
      const uploadUrl = registerData.value?.asset
      const mediaUrn = registerData.value?.asset

      // Upload the media
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: await fetch(mediaUrl).then((r) => r.blob()),
      })

      return mediaUrn
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to upload media')
    }
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      const url = `https://api.linkedin.com/${this.apiVersion}/ugcPosts/${platformPostId}`
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      })

      return response.ok
    } catch {
      return false
    }
  }

  async getProfile(): Promise<PlatformProfile> {
    try {
      const url = `https://api.linkedin.com/${this.apiVersion}/organizations/${this.organizationUrn}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })

      const data = await response.json()

      return {
        id: data.id,
        name: data.name,
        username: data.vanityName,
        avatarUrl: data.logoV2?.original?.url,
        platformUserId: data.id,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch profile')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getMetrics(_dateRange: DateRange): Promise<PlatformMetrics> {
    try {
      const url = `https://api.linkedin.com/${this.apiVersion}/organizationalEntityStatistics?q=organization&organizationalEntity=${this.organizationUrn}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })

      const data = await response.json()
      const stats = data.elements?.[0]?.organizationFollowerStatistics

      return {
        followers: stats?.followerCount || 0,
        engagement: 0, // LinkedIn doesn't provide engagement at org level
        reach: 0,
        impressions: 0,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch metrics')
    }
  }

  async checkTokenHealth(): Promise<boolean> {
    try {
      const url = `https://api.linkedin.com/${this.apiVersion}/userinfo`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      })

      return response.ok
    } catch {
      return false
    }
  }

  async refreshToken(): Promise<string> {
    // LinkedIn tokens can be refreshed, but for now return existing token
    return this.accessToken
  }
}
