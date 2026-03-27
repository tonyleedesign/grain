import { getPrivateCanvasId } from './getCanvasId'
import { supabaseServer } from './supabase-server'
import type {
  CaptureContentKind,
  CaptureIngestRequest,
  PendingCapture,
} from '@/types/captures'

interface CaptureMetadata {
  canonicalUrl?: string
  title?: string
  siteName?: string
  previewImageUrl?: string
  contentKind: CaptureContentKind
  metadata: Record<string, unknown>
}

function getUrlContentKind(sourceType: CaptureIngestRequest['sourceType'], url?: string): CaptureContentKind {
  if (sourceType === 'direct_media_url' && url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase()
      if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(pathname)) return 'image'
      if (/\.(mp4|mov|webm|ogg)$/.test(pathname)) return 'video'
    } catch {}
  }

  return 'bookmark'
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function resolveUrl(url: string | undefined, baseUrl: string) {
  if (!url) return undefined

  try {
    return new URL(decodeHtml(url), baseUrl).toString()
  } catch {
    return undefined
  }
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function readAttribute(tag: string, attr: string) {
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i')
  return tag.match(pattern)?.[1]?.trim()
}

function readMetaTag(html: string, attr: 'property' | 'name', key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []

  for (const tag of tags) {
    const attrValue = readAttribute(tag, attr)
    if (attrValue?.toLowerCase() !== key.toLowerCase()) continue

    const content = readAttribute(tag, 'content')
    if (content) return decodeHtml(content)
  }

  return undefined
}

function readTitle(html: string) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
}

function readCanonical(html: string) {
  const tags = html.match(/<link\b[^>]*>/gi) || []

  for (const tag of tags) {
    const rel = readAttribute(tag, 'rel')
    if (rel?.toLowerCase() !== 'canonical') continue

    const href = readAttribute(tag, 'href')
    if (href) return decodeHtml(href)
  }

  return undefined
}

function readFirstImage(html: string, baseUrl: string) {
  const imgTags = html.match(/<img\b[^>]*>/gi) || []

  for (const tag of imgTags) {
    const src = readAttribute(tag, 'src')
    if (!src) continue
    if (src.startsWith('data:')) continue

    try {
      return new URL(decodeHtml(src), baseUrl).toString()
    } catch {}
  }

  return undefined
}

async function fetchUrlMetadata(
  sourceType: CaptureIngestRequest['sourceType'],
  originalUrl?: string
): Promise<CaptureMetadata> {
  const baseKind = getUrlContentKind(sourceType, originalUrl)
  if (!originalUrl) {
    return {
      contentKind: baseKind,
      metadata: {},
    }
  }

  try {
    const response = await fetch(originalUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Grain Send to Grain/1.0',
      },
    })

    const finalUrl = response.url || originalUrl
    const contentType = response.headers.get('content-type') || ''

    if (contentType.startsWith('image/')) {
      return {
        canonicalUrl: finalUrl,
        previewImageUrl: finalUrl,
        contentKind: 'image',
        metadata: { contentType },
      }
    }

    const html = await response.text()
    const canonicalUrl = readCanonical(html) || finalUrl
    const title =
      readMetaTag(html, 'property', 'og:title') ||
      readMetaTag(html, 'name', 'twitter:title') ||
      readTitle(html)
    const siteName =
      readMetaTag(html, 'property', 'og:site_name') ||
      new URL(finalUrl).hostname.replace(/^www\./, '')
    const previewImageUrl =
      readMetaTag(html, 'property', 'og:image') ||
      readMetaTag(html, 'property', 'og:image:secure_url') ||
      readMetaTag(html, 'name', 'twitter:image') ||
      readMetaTag(html, 'name', 'twitter:image:src') ||
      readFirstImage(html, finalUrl)
    const description =
      readMetaTag(html, 'property', 'og:description') ||
      readMetaTag(html, 'name', 'twitter:description') ||
      readMetaTag(html, 'name', 'description')
    const favicon =
      readAttribute(
        (html.match(/<link\b[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/i) || [''])[0],
        'href'
      ) || ''

    return {
      canonicalUrl,
      title,
      siteName,
      previewImageUrl,
      contentKind: baseKind,
      metadata: {
        contentType,
        description,
        favicon: resolveUrl(favicon, finalUrl),
      },
    }
  } catch {
    if (!originalUrl) {
      return { contentKind: baseKind, metadata: {} }
    }

    return {
      canonicalUrl: originalUrl,
      siteName: getHostname(originalUrl),
      contentKind: baseKind,
      metadata: {},
    }
  }
}

export async function createCaptureForUser(userId: string, request: CaptureIngestRequest) {
  const canvasId = await getPrivateCanvasId(userId)
  const inferred = await fetchUrlMetadata(request.sourceType, request.originalUrl)
  const metadata = {
    ...(inferred.metadata || {}),
    ...(request.metadata || {}),
    ...(request.targetPageId ? { targetPageId: request.targetPageId } : {}),
    ...(request.targetPageName ? { targetPageName: request.targetPageName } : {}),
  }

  const payload = {
    canvas_id: canvasId,
    user_id: userId,
    source_channel: request.sourceChannel,
    source_type: request.sourceType,
    original_url: request.originalUrl ?? null,
    canonical_url: request.canonicalUrl ?? inferred.canonicalUrl ?? request.originalUrl ?? null,
    title: request.title ?? inferred.title ?? null,
    site_name: request.siteName ?? inferred.siteName ?? null,
    preview_image_url: request.previewImageUrl ?? inferred.previewImageUrl ?? null,
    content_kind: request.contentKind ?? inferred.contentKind,
    metadata,
    status: 'ready' as const,
  }

  const { data, error } = await supabaseServer
    .from('captures')
    .insert(payload)
    .select('id, canvas_id, status')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create capture')
  }

  return {
    captureId: data.id,
    canvasId: data.canvas_id,
    status: data.status,
  }
}

export async function getPendingCaptures(canvasId: string): Promise<PendingCapture[]> {
  const { data, error } = await supabaseServer
    .from('captures')
    .select('*')
    .eq('canvas_id', canvasId)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as PendingCapture[]
}

export async function markCapturesApplied(canvasId: string, captureIds: string[]) {
  if (captureIds.length === 0) return

  const { error } = await supabaseServer
    .from('captures')
    .update({
      status: 'applied',
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('canvas_id', canvasId)
    .in('id', captureIds)

  if (error) {
    throw new Error(error.message)
  }
}
