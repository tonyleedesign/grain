import { NextRequest, NextResponse } from 'next/server'
import { createCanvasPage, listCanvasPages } from '@/lib/canvas-pages'
import { getPrivateCanvasId } from '@/lib/getCanvasId'
import { getAuthenticatedUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const canvasId = await getPrivateCanvasId(user.id)
    const pages = await listCanvasPages(canvasId)
    return NextResponse.json({ canvasId, pages })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load pages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  try {
    const canvasId = await getPrivateCanvasId(user.id)
    const page = await createCanvasPage(canvasId, body.name)
    return NextResponse.json({ canvasId, page })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      { status: 500 }
    )
  }
}
