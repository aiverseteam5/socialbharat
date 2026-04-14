import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole } from '@/lib/auth'
import { idParamSchema, inviteMemberSchema } from '@/types/schemas'
import { randomUUID } from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    
    const { id } = await params
    const validationResult = idParamSchema.safeParse({ id })
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid organization ID' },
        { status: 400 }
      )
    }
    
    const { id: orgId } = validationResult.data
    
    // Verify membership
    await requireRole(orgId, ['owner', 'admin', 'editor', 'viewer'])
    
    const supabase = await createClient()
    
    const { data: members, error } = await supabase
      .from('org_members')
      .select(`
        id,
        role,
        invited_at,
        accepted_at,
        user_id,
        users (
          id,
          email,
          phone,
          full_name,
          avatar_url
        )
      `)
      .eq('org_id', orgId)
    
    if (error) {
      console.error('Get members error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ members })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('redirect')) {
        throw error
      }
      if (error.message.includes('not a member') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    console.error('Get members error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    
    const { id } = await params
    const validationResult = idParamSchema.safeParse({ id })
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid organization ID' },
        { status: 400 }
      )
    }
    
    const { id: orgId } = validationResult.data
    
    // Verify membership (owner/admin only)
    await requireRole(orgId, ['owner', 'admin'])
    
    const body = await request.json()
    const inviteValidation = inviteMemberSchema.safeParse(body)
    
    if (!inviteValidation.success) {
      return NextResponse.json(
        { error: 'Invalid invitation data', details: inviteValidation.error.errors },
        { status: 400 }
      )
    }
    
    const { email, phone, role } = inviteValidation.data
    
    const supabase = await createClient()
    
    // Generate invite token
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    // Create invitation
    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        org_id: orgId,
        email: email || null,
        phone: phone || null,
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()
    
    if (error || !invitation) {
      console.error('Create invitation error:', error)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }
    
    // Generate invite link
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`
    
    return NextResponse.json({
      invitation,
      inviteLink,
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('redirect')) {
        throw error
      }
      if (error.message.includes('not a member') || error.message.includes('permission')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    console.error('Invite member error:', error)
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    )
  }
}
