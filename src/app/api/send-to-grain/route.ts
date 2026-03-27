import { NextRequest, NextResponse } from 'next/server'
import { createCaptureForUser } from '@/lib/captures'
import { getAuthenticatedUser } from '@/lib/server-auth'
import type { CaptureIngestRequest } from '@/types/captures'

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as CaptureIngestRequest

  if (!body?.sourceChannel || !body?.sourceType) {
    return NextResponse.json(
      { error: 'sourceChannel and sourceType are required' },
      { status: 400 }
    )
  }

  if (
    (body.sourceType === 'url' ||
      body.sourceType === 'page_url' ||
      body.sourceType === 'direct_media_url') &&
    !body.originalUrl
  ) {
    return NextResponse.json({ error: 'originalUrl is required' }, { status: 400 })
  }

  if (body.originalUrl) {
    try {
      new URL(body.originalUrl)
    } catch {
      return NextResponse.json({ error: 'originalUrl must be a valid URL' }, { status: 400 })
    }
  }

  if (body.targetPageId != null && typeof body.targetPageId !== 'string') {
    return NextResponse.json({ error: 'targetPageId must be a string' }, { status: 400 })
  }

  if (body.targetPageName != null && typeof body.targetPageName !== 'string') {
    return NextResponse.json({ error: 'targetPageName must be a string' }, { status: 400 })
  }

  try {
    const result = await createCaptureForUser(user.id, body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create capture' },
      { status: 500 }
    )
  }
}
