// Fetch board DNA by board name and canvas ID.
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

  return NextResponse.json(data)
}
