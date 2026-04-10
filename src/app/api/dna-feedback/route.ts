// DNA Feedback API — saves and retrieves feedback on exported DNA quality.
// Feedback feeds back into regeneration prompts for iterative improvement.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireCanvasAccess } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const { boardId, rating, whatWasOff } = (await request.json()) as {
      boardId: string
      rating: 'worked' | 'needs_tweaking'
      whatWasOff?: string
    }

    if (!boardId || !rating) {
      return NextResponse.json({ error: 'boardId and rating required' }, { status: 400 })
    }

    const { data: board } = await supabaseServer
      .from('boards')
      .select('canvas_id')
      .eq('id', boardId)
      .single()

    if (!board?.canvas_id) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    const authResponse = await requireCanvasAccess(request, board.canvas_id)
    if (authResponse) return authResponse

    const { error } = await supabaseServer.from('dna_feedback').insert({
      board_id: boardId,
      rating,
      what_was_off: whatWasOff || null,
    })

    if (error) {
      console.error('Feedback save error:', error)
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')

  if (!boardId) {
    return NextResponse.json({ error: 'boardId required' }, { status: 400 })
  }

  const { data: board } = await supabaseServer
    .from('boards')
    .select('canvas_id')
    .eq('id', boardId)
    .single()

  if (!board?.canvas_id) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const authResponse = await requireCanvasAccess(request, board.canvas_id)
  if (authResponse) return authResponse

  const { data, error } = await supabaseServer
    .from('dna_feedback')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json(null)
  }

  return NextResponse.json(data)
}
