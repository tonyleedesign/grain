// Image upload API route — receives images, resizes with Sharp, stores in Supabase.
// Reference: grain-prd.md Section 5.2, 7 (Architecture Flow)

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseServer } from '@/lib/supabase-server'
import { requireCanvasAccess } from '@/lib/server-auth'

const MAX_DIMENSION = 2000

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]
    const canvasId = formData.get('canvasId') as string
    const uploadedBy = formData.get('uploadedBy') as string | null

    if (!files.length) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    if (!canvasId) {
      return NextResponse.json({ error: 'canvasId is required' }, { status: 400 })
    }

    const authResponse = await requireCanvasAccess(request, canvasId)
    if (authResponse) return authResponse

    const results = await Promise.all(
      files.map(async (file) => {
        // Read file into buffer
        const buffer = Buffer.from(await file.arrayBuffer())

        // Resize with Sharp — max 2000px on longest side, preserve aspect ratio
        const processed = await sharp(buffer)
          .resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer()

        // Get dimensions of processed image
        const metadata = await sharp(processed).metadata()

        // Generate unique storage path
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const storagePath = `${canvasId}/${timestamp}-${safeName}.jpg`

        // Upload to Supabase Storage
        const { error: storageError } = await supabaseServer.storage
          .from('images')
          .upload(storagePath, processed, {
            contentType: 'image/jpeg',
            upsert: false,
          })

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabaseServer.storage
          .from('images')
          .getPublicUrl(storagePath)

        // Save metadata to database
        const { data: imageRecord, error: dbError } = await supabaseServer
          .from('images')
          .insert({
            url: urlData.publicUrl,
            storage_path: storagePath,
            uploaded_by: uploadedBy,
            canvas_id: canvasId,
            width: metadata.width || 0,
            height: metadata.height || 0,
          })
          .select()
          .single()

        if (dbError) {
          throw new Error(`Database insert failed: ${dbError.message}`)
        }

        return imageRecord
      })
    )

    return NextResponse.json({ images: results })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
