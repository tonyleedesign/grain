import {
  PageRecordType,
  getIndexAbove,
  type IndexKey,
  type TLPage,
  type TLStoreSnapshot,
} from 'tldraw'
import { supabaseServer } from './supabase-server'
import type { CapturePageSummary } from '@/types/captures'

function isPageRecord(record: unknown): record is TLPage {
  return !!record && typeof record === 'object' && (record as { typeName?: string }).typeName === 'page'
}

function getUniquePageName(baseName: string, existingNames: string[]) {
  const trimmed = baseName.trim() || 'Page'
  if (!existingNames.includes(trimmed)) return trimmed

  let suffix = 2
  while (existingNames.includes(`${trimmed} ${suffix}`)) {
    suffix += 1
  }

  return `${trimmed} ${suffix}`
}

function extractPages(document: TLStoreSnapshot | null): CapturePageSummary[] {
  if (!document?.store) return []

  return Object.values(document.store)
    .filter(isPageRecord)
    .sort((a, b) => a.index.localeCompare(b.index))
    .map((page) => ({
      id: page.id,
      name: page.name,
      index: page.index,
    }))
}

export async function getCanvasDocumentSnapshot(canvasId: string): Promise<TLStoreSnapshot | null> {
  const { data, error } = await supabaseServer
    .from('canvas_documents')
    .select('document_snapshot')
    .eq('canvas_id', canvasId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data?.document_snapshot as TLStoreSnapshot | null) ?? null
}

export async function saveCanvasDocumentSnapshot(canvasId: string, document: TLStoreSnapshot) {
  const { error } = await supabaseServer
    .from('canvas_documents')
    .upsert(
      {
        canvas_id: canvasId,
        document_snapshot: document,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'canvas_id' }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function listCanvasPages(canvasId: string): Promise<CapturePageSummary[]> {
  const document = await getCanvasDocumentSnapshot(canvasId)
  return extractPages(document)
}

export async function createCanvasPage(canvasId: string, name: string): Promise<CapturePageSummary> {
  const document = await getCanvasDocumentSnapshot(canvasId)

  if (!document?.store) {
    throw new Error('Open your private canvas once before creating pages')
  }

  const existingPages = extractPages(document)
  const newPage = PageRecordType.create({
    id: PageRecordType.createId(),
    name: getUniquePageName(name, existingPages.map((page) => page.name)),
    index:
      existingPages.length > 0
        ? getIndexAbove(existingPages[existingPages.length - 1].index as IndexKey)
        : ('a1' as IndexKey),
    meta: {},
  })

  await saveCanvasDocumentSnapshot(canvasId, {
    ...document,
    store: {
      ...document.store,
      [newPage.id]: newPage,
    },
  })

  return {
    id: newPage.id,
    name: newPage.name,
    index: newPage.index,
  }
}
