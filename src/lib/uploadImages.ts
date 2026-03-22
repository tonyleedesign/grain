// Client-side image upload — handles HEIC conversion then sends to API route.
// Reference: grain-prd.md Section 5.2, 7

import heic2any from 'heic2any'

interface UploadResult {
  id: string
  url: string
  storage_path: string
  width: number
  height: number
  position_x: number
  position_y: number
}

interface UploadOptions {
  canvasId: string
  uploadedBy?: string | null
}

async function convertHeicIfNeeded(file: File): Promise<File> {
  const isHeic = file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')

  if (!isHeic) return file

  const blob = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })

  const converted = Array.isArray(blob) ? blob[0] : blob
  return new File(
    [converted],
    file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
    { type: 'image/jpeg' }
  )
}

export async function uploadImages(
  files: File[],
  options: UploadOptions
): Promise<UploadResult[]> {
  // Convert any HEIC files to JPEG client-side
  const converted = await Promise.all(files.map(convertHeicIfNeeded))

  const formData = new FormData()
  formData.set('canvasId', options.canvasId)
  if (options.uploadedBy) {
    formData.set('uploadedBy', options.uploadedBy)
  }
  converted.forEach((file) => formData.append('images', file))

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Upload failed')
  }

  const data = await response.json()
  return data.images
}
