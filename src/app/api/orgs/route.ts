import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
import { createOrgSchema } from '@/types/schemas'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    const body = await request.json()
    const validationResult = createOrgSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid organization data', details: validationResult.error.errors },
        { status: 400 }
      )
    }
    
    const { name, industry, team_size, preferred_language } = validationResult.data
    
    const supabase = await createClient()
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    // Check if slug already exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()
    
    let finalSlug = slug
    
    if (existingOrg) {
      // Append random suffix to make unique
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      finalSlug = `${slug}-${randomSuffix}`
    }
    
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug: finalSlug,
        industry: industry || null,
        team_size: team_size || null,
        preferred_language: preferred_language || 'en',
        plan: 'free',
      })
      .select()
      .single()
    
    if (orgError || !org) {
      console.error('Organization creation error:', orgError)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }
    
    // Add creator as owner
    const { error: memberError } = await supabase.from('org_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
      invited_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    
    if (memberError) {
      console.error('Member creation error:', memberError)
      return NextResponse.json(
        { error: 'Failed to add you as owner' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      organization: org,
      role: 'owner',
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('redirect')) {
      throw error
    }
    console.error('Organization creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
