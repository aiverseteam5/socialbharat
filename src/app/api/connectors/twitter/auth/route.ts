import { redirect } from 'next/navigation'

/**
 * Initiate Twitter OAuth 2.0 flow
 * Redirects user to Twitter OAuth page with required scopes
 */
export async function GET() {
  const clientId = process.env.TWITTER_API_KEY
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/twitter/callback`
  
  const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
  
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId || '')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', scopes.join(' '))
  authUrl.searchParams.set('state', Math.random().toString(36).substring(7))
  authUrl.searchParams.set('code_challenge', 'challenge')
  authUrl.searchParams.set('code_challenge_method', 'plain')
  
  redirect(authUrl.toString())
}
