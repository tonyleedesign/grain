// Board CRUD — fetch and create boards.
// Uses supabaseServer (service role) to bypass RLS for anonymous users.
// Reference: grain-prd.md Section 11.3

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const canvasId = searchParams.get('canvasId')

  if (!name || !canvasId) {
    return NextResponse.json({ error: 'name and canvasId required' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('boards')
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

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
      .eq('id', data.latest_extraction_id)
      .maybeSingle()

    extraction = latestExtraction
  }

  if (!extraction) {
    const { data: fallbackExtraction } = await supabaseServer
      .from('board_extractions')
      .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
      .eq('board_id', data.id)
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
  const { name, canvasId } = (await request.json()) as {
    name: string
    canvasId: string
  }

  if (!name || !canvasId) {
    return NextResponse.json({ error: 'name and canvasId required' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('boards')
    .insert({ canvas_id: canvasId, name })
    .select('id')
    .single()

  if (error) {
    console.error('Board create error:', error)
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}

export async function PATCH(request: NextRequest) {
  const { canvasId, oldName, newName } = (await request.json()) as {
    canvasId: string
    oldName: string
    newName: string
  }

  if (!canvasId || !oldName || !newName) {
    return NextResponse.json(
      { error: 'canvasId, oldName, and newName required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseServer
    .from('boards')
    .update({ name: newName })
    .eq('canvas_id', canvasId)
    .eq('name', oldName)
    .select('id')

  if (error) {
    console.error('Board rename error:', error)
    return NextResponse.json({ error: 'Failed to rename board' }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
