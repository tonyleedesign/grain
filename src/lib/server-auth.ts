import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from './supabase-server'

export interface AuthenticatedUser {
  id: string
  email?: string | null
}

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = getBearerToken(request)
  if (!token) return null

  const { data, error } = await supabaseServer.auth.getUser(token)
  if (error || !data.user) return null

  return {
    id: data.user.id,
    email: data.user.email,
  }
}

// Returns a NextResponse error if access is denied, or null if access is granted.
// Community canvases are publicly accessible (no auth required).
// Private canvases require a valid Bearer token matching the canvas owner_id.
export async function requireCanvasAccess(
  request: NextRequest,
  canvasId: string
): Promise<NextResponse | null> {
  const { data: canvas, error } = await supabaseServer
    .from('canvases')
    .select('type, owner_id')
    .eq('id', canvasId)
    .single()

  if (error || !canvas) {
    return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
  }

  if (canvas.type !== 'private') {
    return null
  }

  const token = getBearerToken(request)
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error: authError } = await supabaseServer.auth.getUser(token)
  if (authError || !data.user || data.user.id !== canvas.owner_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
