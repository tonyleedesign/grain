import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type BoardRow = Record<string, unknown> & {
  id: string
  canvas_id?: string | null
  frame_shape_id?: string | null
  name?: string | null
  latest_extraction_id?: string | null
  medium?: string | null
  use_case?: string | null
  source_context?: string | null
  appeal_context?: string | null
  observations?: string | null
  dna_data?: unknown
  created_at?: string | null
}

function hasDirectBoardDna(board: BoardRow | null) {
  if (!board) return false
  return Boolean(
    board.dna_data ||
    board.observations ||
    board.medium ||
    board.use_case ||
    board.source_context ||
    board.appeal_context ||
    board.latest_extraction_id
  )
}

async function getBoardExtraction(board: BoardRow | null) {
  if (!board) return null

  if (board.latest_extraction_id) {
    const { data: latestExtraction } = await supabaseServer
      .from('board_extractions')
      .select('id, created_at')
      .eq('id', board.latest_extraction_id)
      .maybeSingle()

    if (latestExtraction) return latestExtraction
  }

  const { data: fallbackExtraction } = await supabaseServer
    .from('board_extractions')
    .select('id, created_at')
    .eq('board_id', board.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return fallbackExtraction
}

function getCandidateScore(
  board: BoardRow,
  extraction: Awaited<ReturnType<typeof getBoardExtraction>>,
  frameName: string
) {
  const normalizedFrameName = frameName.trim().toLowerCase()
  const normalizedBoardName = (board.name || '').trim().toLowerCase()
  let score = 0

  if (normalizedBoardName === normalizedFrameName) score += 4
  if (!board.frame_shape_id) score += 2
  if (extraction) score += 8
  else if (hasDirectBoardDna(board)) score += 4

  return score
}

export async function POST(request: NextRequest) {
  const { canvasId, frameShapeId, frameName, boardId: requestedBoardId } = (await request.json()) as {
    canvasId?: string
    frameShapeId?: string
    frameName?: string
    boardId?: string
  }

  if (!canvasId || !frameShapeId || !frameName?.trim()) {
    return NextResponse.json(
      { error: 'canvasId, frameShapeId, and frameName are required' },
      { status: 400 }
    )
  }

  const normalizedFrameName = frameName.trim()

  const { data: existingByFrame } = await supabaseServer
    .from('boards')
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('frame_shape_id', frameShapeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingByFrame?.id) {
    if (existingByFrame.name !== normalizedFrameName) {
      const { error: renameError } = await supabaseServer
        .from('boards')
        .update({ name: normalizedFrameName })
        .eq('id', existingByFrame.id)

      if (renameError) {
        console.error('Existing frame board rename error:', renameError)
      }
    }

    // If a board row is already attached to this exact frame, it is the
    // canonical identity for the frame even if it doesn't have DNA yet.
    return NextResponse.json({ id: existingByFrame.id, repaired: false })
  }

  if (requestedBoardId) {
    const { data: requestedBoard } = await supabaseServer
      .from('boards')
      .select('*')
      .eq('canvas_id', canvasId)
      .eq('id', requestedBoardId)
      .maybeSingle()

    if (requestedBoard?.id) {
      if (requestedBoard.frame_shape_id === frameShapeId) {
        return NextResponse.json({ id: requestedBoard.id, repaired: false })
      }

      const requestedExtraction = await getBoardExtraction(requestedBoard as BoardRow)
      if (requestedExtraction || hasDirectBoardDna(requestedBoard as BoardRow)) {
        const { error: attachError } = await supabaseServer
          .from('boards')
          .update({
            frame_shape_id: frameShapeId,
            name: normalizedFrameName,
          })
          .eq('id', requestedBoard.id)

        if (attachError) {
          console.error('Requested board repair attach error:', attachError)
          return NextResponse.json({ error: 'Failed to attach existing board identity' }, { status: 500 })
        }

        return NextResponse.json({ id: requestedBoard.id, repaired: true })
      }
    }
  }

  if (existingByFrame?.id) {
    return NextResponse.json({ id: existingByFrame.id, repaired: false })
  }

  let candidates: BoardRow[] = []

  const { data: exactCandidates } = await supabaseServer
    .from('boards')
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('name', normalizedFrameName)
    .order('created_at', { ascending: false })
    .limit(50)

  candidates = (exactCandidates as BoardRow[] | null) || []

  if (!candidates.length) {
    const { data: fuzzyCandidates } = await supabaseServer
      .from('boards')
      .select('*')
      .eq('canvas_id', canvasId)
      .ilike('name', normalizedFrameName)
      .order('created_at', { ascending: false })
      .limit(50)

    candidates = (fuzzyCandidates as BoardRow[] | null) || []
  }

  if (!candidates.length) {
    return NextResponse.json({ error: 'No board candidates found' }, { status: 404 })
  }

  let bestCandidate: BoardRow | null = null
  let bestScore = -1

  for (const candidate of candidates) {
    const extraction = await getBoardExtraction(candidate)
    const score = getCandidateScore(candidate, extraction, normalizedFrameName)

    if (score <= bestScore) continue

    bestCandidate = candidate
    bestScore = score
  }

  if (!bestCandidate || bestScore <= 0) {
    return NextResponse.json({ error: 'No repairable board candidate found' }, { status: 404 })
  }

  const { error: updateError } = await supabaseServer
    .from('boards')
    .update({
      frame_shape_id: frameShapeId,
      name: normalizedFrameName,
    })
    .eq('id', bestCandidate.id)

  if (updateError) {
    console.error('Board repair update error:', updateError)
    return NextResponse.json({ error: 'Failed to repair board identity' }, { status: 500 })
  }

  return NextResponse.json({ id: bestCandidate.id, repaired: true })
}
