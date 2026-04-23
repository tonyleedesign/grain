import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')

  if (!rawUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let imageUrl: URL
  try {
    imageUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) image URLs can be proxied' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const response = await fetch(imageUrl.toString(), {
      signal: controller.signal,
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Image fetch failed: ${response.status}` }, { status: 502 })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const bytes = await response.arrayBuffer()

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Image fetch failed'
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
