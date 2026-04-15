import { BasePlatformConnector, PlatformPost, PlatformMetrics, DateRange, PlatformProfile, PlatformPostResult } from './base'

/**
 * YouTube Data API v3 connector
 * Supports uploading videos and fetching video statistics
 */
export class YouTubeConnector extends BasePlatformConnector {
  private apiVersion = 'v3'
  private channelId: string

  constructor(accessToken: string, channelId: string) {
    super(accessToken)
    this.channelId = channelId
  }

  async publishPost(post: PlatformPost): Promise<PlatformPostResult> {
    try {
      if (!post.mediaUrls || post.mediaUrls.length === 0) {
        throw new Error('YouTube requires a video URL')
      }

      const videoUrl = post.mediaUrls[0]
      
      if (!videoUrl) {
        throw new Error('YouTube requires a valid video URL')
      }
      
      // Step 1: Upload video
      const videoId = await this.uploadVideo(videoUrl, post.content)

      return {
        platformPostId: videoId,
        status: 'published',
        url: `https://youtube.com/watch?v=${videoId}`,
      }
    } catch (error) {
      return {
        platformPostId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to upload video',
      }
    }
  }

  private async uploadVideo(videoUrl: string, description: string): Promise<string> {
    try {
      // Step 1: Create upload session
      const uploadUrl = `https://www.googleapis.com/upload/youtube/${this.apiVersion}/videos?uploadType=resumable&part=snippet,status`
      
      const body = {
        snippet: {
          title: description.substring(0, 100),
          description: description.substring(0, 5000),
          channelId: this.channelId,
        },
        status: {
          privacyStatus: 'public',
        },
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const uploadSessionUrl = response.headers.get('location')
      if (!uploadSessionUrl) {
        throw new Error('Failed to create upload session')
      }

      // Step 2: Upload video file
      const videoFile = await fetch(videoUrl).then((r) => r.blob())
      const uploadResponse = await fetch(uploadSessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/*',
          'Content-Length': videoFile.size.toString(),
        },
        body: videoFile,
      })

      const uploadData = await uploadResponse.json()
      return uploadData.id
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to upload video')
    }
  }

  async deletePost(platformPostId: string): Promise<boolean> {
    try {
      const url = `https://www.googleapis.com/youtube/${this.apiVersion}/videos?id=${platformPostId}`
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
      const url = `https://www.googleapis.com/youtube/${this.apiVersion}/channels?part=snippet&id=${this.channelId}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      })

      const data = await response.json()
      const channel = data.items?.[0]

      return {
        id: channel.id,
        name: channel.snippet.title,
        username: channel.snippet.customUrl,
        avatarUrl: channel.snippet.thumbnails?.default?.url,
        platformUserId: channel.id,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch profile')
    }
  }

  async getMetrics(dateRange: DateRange): Promise<PlatformMetrics> {
    try {
      const url = `https://www.googleapis.com/youtube/${this.apiVersion}/channels?part=statistics&id=${this.channelId}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      })

      const data = await response.json()
      const stats = data.items?.[0]?.statistics

      return {
        followers: parseInt(stats.subscriberCount, 10) || 0,
        engagement: 0, // YouTube doesn't provide engagement at channel level
        reach: parseInt(stats.viewCount, 10) || 0,
        impressions: parseInt(stats.viewCount, 10) || 0,
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to fetch metrics')
    }
  }

  async checkTokenHealth(): Promise<boolean> {
    try {
      const url = `https://www.googleapis.com/youtube/${this.apiVersion}/channels?part=snippet&mine=true`
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
    // YouTube tokens can be refreshed, but for now return existing token
    return this.accessToken
  }
}
