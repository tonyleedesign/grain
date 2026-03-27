import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: canvasId } = await params

  if (!canvasId) {
    return NextResponse.json({ error: 'canvasId is required' }, { status: 400 })
  }

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
