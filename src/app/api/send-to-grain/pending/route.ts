import { NextRequest, NextResponse } from 'next/server'
import { deletePendingCaptures, getPendingCaptures, markCapturesApplied } from '@/lib/captures'
import { getAuthenticatedUser } from '@/lib/server-auth'
import { getPrivateCanvasId } from '@/lib/getCanvasId'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const canvasId = request.nextUrl.searchParams.get('canvasId')
  if (!canvasId) {
    return NextResponse.json({ error: 'canvasId is required' }, { status: 400 })
  }

  const privateCanvasId = await getPrivateCanvasId(user.id)
  if (privateCanvasId !== canvasId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const captures = await getPendingCaptures(canvasId)
    return NextResponse.json({ captures })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load captures' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { canvasId, captureIds } = (await request.json()) as {
    canvasId?: string
    captureIds?: string[]
  }

  if (!canvasId || !captureIds?.length) {
    return NextResponse.json(
      { error: 'canvasId and captureIds are required' },
      { status: 400 }
    )
  }

  const privateCanvasId = await getPrivateCanvasId(user.id)
  if (privateCanvasId !== canvasId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await markCapturesApplied(canvasId, captureIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark captures applied' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { canvasId, captureIds } = (await request.json()) as {
    canvasId?: string
    captureIds?: string[]
  }

  if (!canvasId || !captureIds?.length) {
    return NextResponse.json(
      { error: 'canvasId and captureIds are required' },
      { status: 400 }
    )
  }

  const privateCanvasId = await getPrivateCanvasId(user.id)
  if (privateCanvasId !== canvasId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await deletePendingCaptures(canvasId, captureIds)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete captures' },
      { status: 500 }
    )
  }
}
