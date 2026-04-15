import { redirect } from 'next/navigation'

/**
 * Initiate LinkedIn OAuth flow
 * Redirects user to LinkedIn OAuth page with required scopes
 */
export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/linkedin/callback`
  
  const scopes = ['r_liteprofile', 'w_member_social', 'r_organization_admin', 'w_organization_social']
  
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('state', Math.random().toString(36).substring(7))
  
  redirect(authUrl.toString())
}
