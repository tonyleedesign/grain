import { NextRequest } from 'next/server'
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
