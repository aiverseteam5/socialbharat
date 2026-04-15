import { BasePlatformConnector } from './base'
import { FacebookConnector } from './facebook'
import { InstagramConnector } from './instagram'
import { TwitterConnector } from './twitter'
import { LinkedInConnector } from './linkedin'
import { YouTubeConnector } from './youtube'
import { WhatsAppConnector } from './whatsapp'

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'whatsapp'

export interface PlatformConnectorConfig {
  accessToken: string
  platformUserId?: string
  organizationUrn?: string // For LinkedIn
  personUrn?: string // For LinkedIn
  phoneNumberId?: string // For WhatsApp
}

/**
 * Factory function to get the correct platform connector instance
 * @param platform - The social platform type
 * @param config - Configuration including access token and platform-specific IDs
 * @returns Platform connector instance
 */
export function getPlatformConnector(
  platform: SocialPlatform,
  config: PlatformConnectorConfig
): BasePlatformConnector {
  const { accessToken, platformUserId, organizationUrn, personUrn, phoneNumberId } = config

  switch (platform) {
    case 'facebook':
      if (!platformUserId) {
        throw new Error('Facebook requires platformUserId (page ID)')
      }
      return new FacebookConnector(accessToken, platformUserId)

    case 'instagram':
      if (!platformUserId) {
        throw new Error('Instagram requires platformUserId (Instagram Business Account ID)')
      }
      return new InstagramConnector(accessToken, platformUserId)

    case 'twitter':
      return new TwitterConnector(accessToken)

    case 'linkedin':
      if (!personUrn || !organizationUrn) {
        throw new Error('LinkedIn requires personUrn and organizationUrn')
      }
      return new LinkedInConnector(accessToken, personUrn, organizationUrn)

    case 'youtube':
      if (!platformUserId) {
        throw new Error('YouTube requires platformUserId (channel ID)')
      }
      return new YouTubeConnector(accessToken, platformUserId)

    case 'whatsapp':
      if (!phoneNumberId) {
        throw new Error('WhatsApp requires phoneNumberId')
      }
      return new WhatsAppConnector(accessToken, phoneNumberId)

    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
