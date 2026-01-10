/**
 * Media Upload API Endpoint
 * POST /api/postiz/media/upload
 * Handle media file uploads for social media posts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import type { MediaType, ProcessingStatus } from '@/lib/postiz/data-model'

export const runtime = 'nodejs'

/**
 * POST /api/postiz/media/upload
 * Upload media files for posts
 */
export async function POST(request: NextRequest) {
  let user: any = null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const workspaceId = formData.get('workspace_id') as string

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing file or workspace_id' },
        { status: 400 }
      )
    }

    // Verify user has access to workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Validate file
    const validation = await validateFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Upload to Supabase Storage
    const serviceSupabase = getServiceRoleClient()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${validation.extension}`
    const filePath = `postiz/${workspaceId}/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to storage
    const { data: uploadData, error: uploadError } = await serviceSupabase.storage
      .from('media')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[POST /api/postiz/media/upload] Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = serviceSupabase.storage
      .from('media')
      .getPublicUrl(filePath)

    // Store metadata in database (matching actual schema from migration)
    interface MediaAssetInsert {
      workspace_id: string
      name: string
      storage_path: string
      storage_bucket: string
      file_size_bytes: number
      mime_type: string
      media_type: MediaType
      width: number | null
      height: number | null
      duration_seconds: number | null
      processing_status: ProcessingStatus
      alt_text: string | null
    }

    interface MediaAssetSelect {
      id: string
      media_type: MediaType
      file_size_bytes: number
      width: number | null
      height: number | null
      duration_seconds: number | null
    }

    const insertData: MediaAssetInsert = {
      workspace_id: workspaceId,
      name: file.name,
      storage_path: filePath,
      storage_bucket: 'postiz-media',
      file_size_bytes: buffer.length,
      mime_type: file.type,
      media_type: validation.type || 'image',
      width: validation.width || null,
      height: validation.height || null,
      duration_seconds: validation.duration || null,
      processing_status: 'completed' as ProcessingStatus,
      alt_text: null,
    }

    const { data: mediaAssetResult, error: dbError } = await (serviceSupabase
      .from('media_assets')
      .insert(insertData as any)
      .select('id, media_type, file_size_bytes, width, height, duration_seconds')
      .single() as Promise<{ data: MediaAssetSelect | null; error: any }>)

    const mediaAsset = mediaAssetResult as MediaAssetSelect | null

    if (dbError || !mediaAsset) {
      console.error('[POST /api/postiz/media/upload] Database error:', dbError)
      // Clean up uploaded file
      await serviceSupabase.storage
        .from('media')
        .remove([filePath])
      return NextResponse.json(
        { error: 'Failed to save media metadata' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      media: {
        id: mediaAsset.id,
        type: mediaAsset.media_type,
        url: publicUrl,
        size: mediaAsset.file_size_bytes,
        metadata: {
          width: mediaAsset.width,
          height: mediaAsset.height,
          duration: mediaAsset.duration_seconds,
        },
      },
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/media/upload] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Validate uploaded file
 */
async function validateFile(file: File): Promise<{
  valid: boolean
  error?: string
  type?: MediaType
  extension?: string
  width?: number
  height?: number
  duration?: number
}> {
  // Check file size (max 100MB)
  const MAX_SIZE = 100 * 1024 * 1024 // 100MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 100MB limit' }
  }

  // Check MIME type
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']

  let type: MediaType | undefined
  let extension: string

  if (allowedImageTypes.includes(file.type)) {
    // Check if it's a GIF specifically
    if (file.type === 'image/gif') {
      type = 'gif'
    } else {
      type = 'image'
    }
    extension = file.type.split('/')[1]
  } else if (allowedVideoTypes.includes(file.type)) {
    type = 'video'
    extension = file.type.split('/')[1]
  } else {
    return { valid: false, error: 'Unsupported file type. Only images (JPEG, PNG, GIF, WebP) and videos (MP4, MOV, AVI) are allowed.' }
  }

  // For images, get dimensions (basic validation)
  if (type === 'image') {
    try {
      // This would require additional processing in a real implementation
      // For now, just basic validation
      return {
        valid: true,
        type,
        extension,
      }
    } catch (error) {
      return { valid: false, error: 'Failed to process image' }
    }
  }

  // For videos, basic validation
  if (type === 'video') {
    return {
      valid: true,
      type,
      extension,
    }
  }

  return { valid: false, error: 'Unknown validation error' }
}
