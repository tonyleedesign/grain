// Board CRUD — fetch and create boards.
// Uses supabaseServer (service role) to bypass RLS for anonymous users.
// Reference: grain-prd.md Section 11.3

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireCanvasAccess } from '@/lib/server-auth'

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

  if (canvasId) {
    const authResponse = await requireCanvasAccess(request, canvasId)
    if (authResponse) return authResponse
  }

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
  }

  async function getBoardExtraction(board: BoardRow | null) {
    if (!board) return null

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

    if (board.latest_extraction_id) {
      const { data: latestExtraction } = await supabaseServer
        .from('board_extractions')
        .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
        .eq('id', board.latest_extraction_id)
        .maybeSingle()

      extraction = latestExtraction
    }

    if (!extraction) {
      const { data: fallbackExtraction } = await supabaseServer
        .from('board_extractions')
        .select('id, medium, use_case, source_context, appeal_context, observations, dna_data')
        .eq('board_id', board.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      extraction = fallbackExtraction
    }

    return extraction
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

  function getCandidateScore(board: BoardRow, extraction: Awaited<ReturnType<typeof getBoardExtraction>>) {
    let score = 0

    // A board already attached to the requested frame is the canonical winner.
    if (frameShapeId && board.frame_shape_id === frameShapeId) score += 100
    // An explicit board id should also strongly beat name-based candidates.
    if (boardId && board.id === boardId) score += 50
    if (name && board.name === name) score += 5

    if (extraction) {
      score += 8
    } else if (hasDirectBoardDna(board)) {
      score += 4
    }

    return score
  }

  async function getBoardCandidates() {
    const candidates: BoardRow[] = []
    const seen = new Set<string>()

    const pushCandidate = (candidate: BoardRow | null | undefined) => {
      if (!candidate?.id || seen.has(candidate.id)) return
      seen.add(candidate.id)
      candidates.push(candidate)
    }

    if (boardId) {
      let query = supabaseServer.from('boards').select('*').eq('id', boardId)
      if (canvasId) {
        query = query.eq('canvas_id', canvasId)
      }
      const { data } = await query.maybeSingle()
      pushCandidate(data as BoardRow | null)
    }

    if (canvasId && frameShapeId) {
      const { data } = await supabaseServer
        .from('boards')
        .select('*')
        .eq('canvas_id', canvasId)
        .eq('frame_shape_id', frameShapeId)
        .order('created_at', { ascending: false })
        .limit(20)

      for (const candidate of data || []) {
        pushCandidate(candidate as BoardRow)
      }
    }

    if (canvasId && name) {
      const normalizedName = name.trim()
      const { data } = await supabaseServer
        .from('boards')
        .select('*')
        .eq('canvas_id', canvasId)
        .eq('name', normalizedName)
        .order('created_at', { ascending: false })
        .limit(20)

      for (const candidate of data || []) {
        pushCandidate(candidate as BoardRow)
      }

      if (!data?.length && normalizedName) {
        const { data: fuzzyData } = await supabaseServer
          .from('boards')
          .select('*')
          .eq('canvas_id', canvasId)
          .ilike('name', normalizedName)
          .order('created_at', { ascending: false })
          .limit(20)

        for (const candidate of fuzzyData || []) {
          pushCandidate(candidate as BoardRow)
        }
      }
    }

    return candidates
  }

  const candidates = await getBoardCandidates()

  if (!candidates.length) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  let data = candidates[0]
  let extraction = await getBoardExtraction(data)
  let bestScore = getCandidateScore(data, extraction)

  for (let i = 1; i < candidates.length; i++) {
    const candidate = candidates[i]
    const candidateExtraction = await getBoardExtraction(candidate)
    const candidateScore = getCandidateScore(candidate, candidateExtraction)

    if (candidateScore <= bestScore) continue

    data = candidate
    extraction = candidateExtraction
    bestScore = candidateScore
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

  const authResponse = await requireCanvasAccess(request, canvasId)
  if (authResponse) return authResponse

  if (frameShapeId) {
    const { data: existingByFrame } = await supabaseServer
      .from('boards')
      .select('id')
      .eq('canvas_id', canvasId)
      .eq('frame_shape_id', frameShapeId)
      .order('created_at', { ascending: false })
      .limit(1)
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

  const authResponse = await requireCanvasAccess(request, canvasId)
  if (authResponse) return authResponse

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
