import { redirect } from 'next/navigation'

/**
 * Initiate Instagram OAuth flow
 * Redirects user to Facebook OAuth page with Instagram scopes
 */
export async function GET() {
  const appId = process.env.META_APP_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/instagram/callback`
  
  const scopes = ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
  
  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes.join(','))
  authUrl.searchParams.set('response_type', 'code')
  
  redirect(authUrl.toString())
}
