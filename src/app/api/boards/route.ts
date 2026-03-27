// Board CRUD — fetch and create boards.
// Uses supabaseServer (service role) to bypass RLS for anonymous users.
// Reference: grain-prd.md Section 11.3

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')
  const frameShapeId = searchParams.get('frameShapeId')
  const name = searchParams.get('name')
  const canvasId = searchParams.get('canvasId')

  if (!boardId && !canvasId) {
    return NextResponse.json(
      { error: 'boardId or (frameShapeId and canvasId) or (name and canvasId) required' },
      { status: 400 }
    )
  }

  let data: Record<string, unknown> | null = null
  let error: unknown = null

  if (boardId) {
    const result = await supabaseServer
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle()
    data = result.data
    error = result.error
  } else if (canvasId && frameShapeId) {
    const byFrame = await supabaseServer
      .from('boards')
      .select('*')
      .eq('canvas_id', canvasId)
      .eq('frame_shape_id', frameShapeId)
      .maybeSingle()

    data = byFrame.data
    error = byFrame.error

    if (!data && name) {
      const byName = await supabaseServer
        .from('boards')
        .select('*')
        .eq('canvas_id', canvasId)
        .eq('name', name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      data = byName.data
      error = byName.error
    }
  } else if (canvasId && name) {
    const byName = await supabaseServer
      .from('boards')
      .select('*')
      .eq('canvas_id', canvasId)
      .eq('name', name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    data = byName.data
    error = byName.error
  }

  if (error || !data) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  let extraction:
    | {
        id: string
        medium: string | null
        use_case: string | null
        source_context: string | null
        appeal_context: string | null
        observations: string | null
        dna_data: unknown
      }
    | null = null

  if (data.latest_extraction_id) {
    const { data: latestExtraction } = await supabaseServer
      .from('board_extractions')
      .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
      .eq('id', data.latest_extraction_id as string)
      .maybeSingle()

    extraction = latestExtraction
  }

  if (!extraction) {
    const { data: fallbackExtraction } = await supabaseServer
      .from('board_extractions')
      .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
      .eq('board_id', data.id as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    extraction = fallbackExtraction
  }

  return NextResponse.json({
    ...data,
    extraction_id: extraction?.id || null,
    medium: extraction?.medium ?? data.medium ?? null,
    use_case: extraction?.use_case ?? data.use_case ?? null,
    source_context: extraction?.source_context ?? data.source_context ?? null,
    appeal_context: extraction?.appeal_context ?? data.appeal_context ?? null,
    observations: extraction?.observations ?? data.observations ?? null,
    dna_data: extraction?.dna_data ?? data.dna_data ?? null,
    needs_extraction: !(extraction?.dna_data ?? data.dna_data),
  })
}

export async function POST(request: NextRequest) {
  const { name, canvasId, frameShapeId } = (await request.json()) as {
    name: string
    canvasId: string
    frameShapeId?: string
  }

  if (!name || !canvasId) {
    return NextResponse.json({ error: 'name and canvasId required' }, { status: 400 })
  }

  if (frameShapeId) {
    const { data: existingByFrame } = await supabaseServer
      .from('boards')
      .select('id')
      .eq('canvas_id', canvasId)
      .eq('frame_shape_id', frameShapeId)
      .maybeSingle()

    if (existingByFrame?.id) {
      return NextResponse.json({ id: existingByFrame.id })
    }
  }

  const { data, error } = await supabaseServer
    .from('boards')
    .insert({ canvas_id: canvasId, name, frame_shape_id: frameShapeId || null })
    .select('id')
    .single()

  if (error) {
    console.error('Board create error:', error)
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export async function PATCH(request: NextRequest) {
  const { canvasId, oldName, newName, boardId, frameShapeId } = (await request.json()) as {
    canvasId: string
    oldName?: string
    newName?: string
    boardId?: string
    frameShapeId?: string
  }

  if (!canvasId || (!newName && !frameShapeId) || (!boardId && !frameShapeId && !oldName)) {
    return NextResponse.json(
      { error: 'canvasId and a board identifier plus update fields are required' },
      { status: 400 }
    )
  }

  let query = supabaseServer.from('boards').update({
    ...(newName ? { name: newName } : {}),
    ...(frameShapeId ? { frame_shape_id: frameShapeId } : {}),
  }).eq('canvas_id', canvasId)

  if (boardId) {
    query = query.eq('id', boardId)
  } else if (oldName) {
    query = query.eq('name', oldName)
  } else {
    query = query.eq('frame_shape_id', frameShapeId as string)
  }

  const { data, error } = await query.select('id')

  if (error) {
    console.error('Board rename error:', error)
    return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
