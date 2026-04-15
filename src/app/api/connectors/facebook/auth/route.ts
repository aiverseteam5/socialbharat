import { redirect } from 'next/navigation'

/**
 * Initiate Facebook OAuth flow
 * Redirects user to Facebook OAuth page with required scopes
 */
export async function GET() {
  const appId = process.env.META_APP_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/facebook/callback`
  
  const scopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_read_user_content', 'instagram_basic', 'instagram_content_publish']
  
  const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  authUrl.searchParams.set('client_id', appId || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes.join(','))
  authUrl.searchParams.set('response_type', 'code')
  
  redirect(authUrl.toString())
}
