import { redirect } from 'next/navigation'

/**
 * Initiate YouTube OAuth flow
 * Redirects user to Google OAuth page with required scopes
 */
export async function GET() {
  const clientId = process.env.YOUTUBE_API_KEY
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/youtube/callback`
  
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
  ]
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  
  redirect(authUrl.toString())
}
