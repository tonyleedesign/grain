// Fetches canvas IDs from Supabase. Used by page routes to pass canvasId to GrainCanvas.
// Reference: grain-prd.md Section 4, 8

import { supabaseServer } from './supabase-server'

export async function getCommunityCanvasId(): Promise<string> {
  const { data, error } = await supabaseServer
    .from('canvases')
    .select('id')
    .eq('type', 'community')
    .single()

  if (error || !data) {
    throw new Error('Community canvas not found')
  }

  return data.id
}

export async function getPrivateCanvasId(ownerId: string): Promise<string> {
  // Find existing or create new private canvas for owner
  const { data: existing } = await supabaseServer
    .from('canvases')
    .select('id')
    .eq('type', 'private')
    .eq('owner_id', ownerId)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await supabaseServer
    .from('canvases')
    .insert({ type: 'private', owner_id: ownerId })
    .select('id')
    .single()

  if (error || !created) {
    throw new Error('Failed to create private canvas')
  }

  return created.id
}
