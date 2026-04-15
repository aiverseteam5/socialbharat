/**
 * Base interface for all social platform connectors
 * Each platform implements these methods with platform-specific logic
 */

export interface PlatformPost {
  content: string
  mediaUrls?: string[]
  scheduledAt?: Date
}

export interface PlatformMetrics {
  followers: number
  engagement: number
  reach: number
  impressions?: number
}

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface PlatformProfile {
  id: string
  name: string
  username?: string
  avatarUrl?: string
  platformUserId: string
}

export interface PlatformPostResult {
  platformPostId: string
  url?: string
  status: 'published' | 'failed'
  error?: string
}

/**
 * Abstract base class for social platform connectors
 * All platform-specific connectors must extend this class
 */
export abstract class BasePlatformConnector {
  protected accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  /**
   * Publish a post to the platform
   * @param post - Post content and media
   * @returns Platform post ID and status
   */
  abstract publishPost(post: PlatformPost): Promise<PlatformPostResult>

  /**
   * Delete a post from the platform
   * @param platformPostId - The platform's post ID
   * @returns Success status
   */
  abstract deletePost(platformPostId: string): Promise<boolean>

  /**
   * Get the connected profile information
   * @returns Profile details
   */
  abstract getProfile(): Promise<PlatformProfile>

  /**
   * Get metrics for the profile within a date range
   * @param dateRange - Start and end date
   * @returns Platform metrics
   */
  abstract getMetrics(dateRange: DateRange): Promise<PlatformMetrics>

  /**
   * Check if the access token is valid
   * @returns Token health status
   */
  abstract checkTokenHealth(): Promise<boolean>

  /**
   * Refresh the access token if needed
   * @returns New access token (if refreshed) or existing one
   */
  abstract refreshToken(): Promise<string>
}
