import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

async function authorizeCanvasAccess(request: NextRequest, canvasId: string) {
  const { data: canvas, error } = await supabaseServer
    .from('canvases')
    .select('id, type, owner_id')
    .eq('id', canvasId)
    .single()

  if (error || !canvas) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
  }

  if (canvas.type !== 'private') {
    return null
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error: authError } = await supabaseServer.auth.getUser(token)
  if (authError || !data.user || data.user.id !== canvas.owner_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: canvasId } = await params

  if (!canvasId) {
    return NextResponse.json({ error: 'canvasId is required' }, { status: 400 })
  }

  const authResponse = await authorizeCanvasAccess(request, canvasId)
  if (authResponse) return authResponse

  const { data, error } = await supabaseServer
    .from('canvas_documents')
    .select('document_snapshot, updated_at')
    .eq('canvas_id', canvasId)
    .maybeSingle()

  if (error) {
    console.error('Canvas document fetch error:', error)
    return NextResponse.json({ error: 'Failed to load canvas document' }, { status: 500 })
  }

  return NextResponse.json({
    document: data?.document_snapshot ?? null,
    updated_at: data?.updated_at ?? null,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: canvasId } = await params
  const { document } = (await request.json()) as {
    document: Record<string, unknown>
  }

  if (!canvasId || !document) {
    return NextResponse.json({ error: 'canvasId and document are required' }, { status: 400 })
  }

  const authResponse = await authorizeCanvasAccess(request, canvasId)
  if (authResponse) return authResponse

  const { error } = await supabaseServer
    .from('canvas_documents')
    .upsert(
      {
        canvas_id: canvasId,
        document_snapshot: document,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'canvas_id' }
    )

  if (error) {
    console.error('Canvas document save error:', error)
    return NextResponse.json({ error: 'Failed to save canvas document' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
