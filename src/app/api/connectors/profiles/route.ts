import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { getPlatformConnector } from '@/lib/platforms'
import { NextResponse } from 'next/server'

/**
 * GET /api/connectors/profiles
 * List all connected social profiles for the current organization
 * Includes decrypted token health status
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user's organization
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    
    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }
    
    const orgId = orgMember.org_id
    
    // Fetch all connected profiles
    const { data: profiles, error } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // Check health status for each profile
    const profilesWithHealth = await Promise.all(
      (profiles || []).map(async (profile) => {
        try {
          const decryptedToken = decrypt(profile.access_token)
          const connector = getPlatformConnector(profile.platform as 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'whatsapp', {
            accessToken: decryptedToken,
            platformUserId: profile.platform_user_id,
            organizationUrn: profile.metadata?.organization_urn as string | undefined,
            personUrn: profile.metadata?.person_urn as string | undefined,
            phoneNumberId: profile.metadata?.phone_number_id as string | undefined,
          })
          
          const isHealthy = await connector.checkTokenHealth()
          
          return {
            ...profile,
            access_token: undefined, // Never return decrypted token
            is_healthy: isHealthy,
          }
        } catch {
          return {
            ...profile,
            access_token: undefined,
            is_healthy: false,
          }
        }
      })
    )
    
    return NextResponse.json({ profiles: profilesWithHealth })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profiles' },
      { status: 500 }
    )
  }
}
