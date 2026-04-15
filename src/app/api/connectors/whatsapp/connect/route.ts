import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const connectWhatsAppSchema = z.object({
  phoneNumberId: z.string(),
  accessToken: z.string(),
})

/**
 * Connect WhatsApp Business API manually
 * Accepts phone_number_id and access_token directly, encrypts and stores in social_profiles
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const parsed = connectWhatsAppSchema.parse(body)
    
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
    const encryptedToken = encrypt(parsed.accessToken)
    
    // Store WhatsApp profile
    await supabase.from('social_profiles').upsert({
      org_id: orgId,
      platform: 'whatsapp',
      platform_user_id: parsed.phoneNumberId,
      platform_username: `WhatsApp Business (${parsed.phoneNumberId})`,
      access_token: encryptedToken,
      metadata: {
        phone_number_id: parsed.phoneNumberId,
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect WhatsApp' },
      { status: 500 }
    )
  }
}
