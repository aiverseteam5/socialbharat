import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/media/upload
 * Upload a file to Supabase Storage and create media asset record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
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
    
    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${orgId}/${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase
      .storage
      .from('media')
      .upload(fileName, file)
    
    if (uploadError) {
      throw uploadError
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('media')
      .getPublicUrl(fileName)
    
    // Create media asset record
    const { data: mediaAsset, error: dbError } = await supabase
      .from('media_assets')
      .insert({
        org_id: orgId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
        public_url: publicUrl,
        uploaded_by: user.id,
      })
      .select()
      .single()
    
    if (dbError) {
      throw dbError
    }
    
    return NextResponse.json({ mediaAsset }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
