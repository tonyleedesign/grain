import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type ExtractionRow = {
  id: string
  medium: string | null
  use_case: string | null
  source_context: string | null
  appeal_context: string | null
  observations: string | null
  dna_data: unknown
}

async function getLatestExtraction(boardId: string): Promise<ExtractionRow | null> {
  const { data: latestByPointer } = await supabaseServer
    .from('boards')
    .select('latest_extraction_id')
    .eq('id', boardId)
    .maybeSingle()

  if (latestByPointer?.latest_extraction_id) {
    const { data } = await supabaseServer
      .from('board_extractions')
      .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
      .eq('id', latestByPointer.latest_extraction_id)
      .maybeSingle()

    if (data) return data
  }

  const { data } = await supabaseServer
    .from('board_extractions')
    .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function POST(request: NextRequest) {
  const { sourceBoardId, canvasId, frameShapeId, name } = (await request.json()) as {
    sourceBoardId?: string
    canvasId?: string
    frameShapeId?: string
    name?: string
  }

  if (!sourceBoardId || !canvasId || !frameShapeId || !name?.trim()) {
    return NextResponse.json(
      { error: 'sourceBoardId, canvasId, frameShapeId, and name are required' },
      { status: 400 }
    )
  }

  const normalizedName = name.trim()

  const { data: existingByFrame } = await supabaseServer
    .from('boards')
    .select('id')
    .eq('canvas_id', canvasId)
    .eq('frame_shape_id', frameShapeId)
    .maybeSingle()

  if (existingByFrame?.id) {
    return NextResponse.json({ id: existingByFrame.id, cloned: false })
  }

  const { data: sourceBoard } = await supabaseServer
    .from('boards')
    .select('id, canvas_id, name')
    .eq('id', sourceBoardId)
    .maybeSingle()

  if (!sourceBoard?.id) {
    return NextResponse.json({ error: 'Source board not found' }, { status: 404 })
  }

  const { data: clonedBoard, error: insertBoardError } = await supabaseServer
    .from('boards')
    .insert({
      canvas_id: canvasId,
      name: normalizedName,
      frame_shape_id: frameShapeId,
    })
    .select('id')
    .single()

  if (insertBoardError || !clonedBoard) {
    console.error('Board clone insert error:', insertBoardError)
    return NextResponse.json({ error: 'Failed to clone board' }, { status: 500 })
  }

  const sourceExtraction = await getLatestExtraction(sourceBoardId)

  if (!sourceExtraction) {
    return NextResponse.json({ id: clonedBoard.id, cloned: true, hasExtraction: false })
  }

  const { data: clonedExtraction, error: insertExtractionError } = await supabaseServer
    .from('board_extractions')
    .insert({
      board_id: clonedBoard.id,
      medium: sourceExtraction.medium,
      use_case: sourceExtraction.use_case,
      source_context: sourceExtraction.source_context,
      appeal_context: sourceExtraction.appeal_context,
      observations: sourceExtraction.observations,
      dna_data: sourceExtraction.dna_data,
    })
    .select('id')
    .single()

  if (insertExtractionError || !clonedExtraction) {
    console.error('Board clone extraction error:', insertExtractionError)
    return NextResponse.json({ error: 'Failed to clone board extraction' }, { status: 500 })
  }

  const { error: updateBoardError } = await supabaseServer
    .from('boards')
    .update({ latest_extraction_id: clonedExtraction.id })
    .eq('id', clonedBoard.id)

  if (updateBoardError) {
    console.error('Board clone latest extraction update error:', updateBoardError)
  }

  return NextResponse.json({ id: clonedBoard.id, cloned: true, hasExtraction: true })
}
