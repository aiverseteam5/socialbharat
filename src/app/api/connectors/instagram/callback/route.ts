import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

/**
 * Handle Instagram OAuth callback
 * Exchanges code for access token, fetches Instagram Business accounts, stores encrypted token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  
  if (error) {
    redirect(`/dashboard/settings/social-accounts?error=${encodeURIComponent(error)}`)
  }
  
  if (!code) {
    redirect('/dashboard/settings/social-accounts?error=no_code')
  }
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect('/login')
    }
    
    // Exchange code for access token
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/instagram/callback`
    
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', appId || '')
    tokenUrl.searchParams.set('client_secret', appSecret || '')
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)
    
    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()
    
    if (tokenData.error) {
      throw new Error(tokenData.error.message)
    }
    
    const accessToken = tokenData.access_token
    
    // Get user's Instagram Business accounts
    const igAccountsUrl = new URL('https://graph.facebook.com/v19.0/me/accounts')
    igAccountsUrl.searchParams.set('fields', 'instagram_business_account')
    igAccountsUrl.searchParams.set('access_token', accessToken)
    
    const igAccountsResponse = await fetch(igAccountsUrl.toString())
    const igAccountsData = await igAccountsResponse.json()
    
    if (igAccountsData.error) {
      throw new Error(igAccountsData.error.message)
    }
    
    const accounts = igAccountsData.data || []
    
    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    
    if (!orgMember) {
      redirect('/onboarding')
    }
    
    const orgId = orgMember.org_id
    const encryptedToken = encrypt(accessToken)
    
    // Store each Instagram Business account
    for (const account of accounts) {
      const igBusinessAccount = account.instagram_business_account
      
      if (!igBusinessAccount) continue
      
      // Fetch Instagram account details
      const igDetailsUrl = new URL(`https://graph.facebook.com/v19.0/${igBusinessAccount.id}`)
      igDetailsUrl.searchParams.set('fields', 'id,username,profile_picture_url')
      igDetailsUrl.searchParams.set('access_token', accessToken)
      
      const igDetailsResponse = await fetch(igDetailsUrl.toString())
      const igDetails = await igDetailsResponse.json()
      
      await supabase.from('social_profiles').upsert({
        org_id: orgId,
        platform: 'instagram',
        platform_user_id: igDetails.id,
        platform_username: igDetails.username,
        access_token: encryptedToken,
        metadata: {
          profile_picture_url: igDetails.profile_picture_url,
          facebook_page_id: account.id,
        },
      })
    }
    
    redirect('/dashboard/settings/social-accounts?success=instagram_connected')
  } catch (error) {
    redirect(`/dashboard/settings/social-accounts?error=${encodeURIComponent(error instanceof Error ? error.message : 'Failed to connect Instagram')}`)
  }
}
