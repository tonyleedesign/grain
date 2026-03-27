'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor, TLEditorSnapshot } from 'tldraw'

type DocumentSnapshot = TLEditorSnapshot['document']

interface UseCanvasDocumentSyncOptions {
  canvasId: string
  accessToken?: string | null
}

export function useCanvasDocumentSync({ canvasId, accessToken }: UseCanvasDocumentSyncOptions) {
  const [snapshot, setSnapshot] = useState<{ document: DocumentSnapshot } | undefined>(undefined)
  const [hasServerDocument, setHasServerDocument] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const lastSavedRef = useRef<string | null>(null)

  const requestHeaders = useMemo(() => {
    const headers: HeadersInit = {}
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
    return headers
  }, [accessToken])

  useEffect(() => {
    let cancelled = false

    async function loadDocument() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/canvases/${canvasId}/document`, {
          headers: requestHeaders,
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load canvas document')
        }

        const data = (await response.json()) as { document: DocumentSnapshot | null }
        if (cancelled) return

        if (data.document) {
          setSnapshot({ document: data.document })
          lastSavedRef.current = JSON.stringify(data.document)
          setHasServerDocument(true)
        } else {
          setSnapshot(undefined)
          lastSavedRef.current = null
          setHasServerDocument(false)
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load canvas document')
        setLoading(false)
      }
    }

    loadDocument()

    return () => {
      cancelled = true
    }
  }, [canvasId, requestHeaders])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const scheduleSave = useCallback(
    async (document: DocumentSnapshot) => {
      const serialized = JSON.stringify(document)
      if (serialized === lastSavedRef.current) return

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          const response = await fetch(`/api/canvases/${canvasId}/document`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...requestHeaders,
            },
            body: JSON.stringify({ document }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'Failed to save canvas document')
          }

          lastSavedRef.current = serialized
        } catch (err) {
          console.error('Canvas document save failed:', err)
        }
      }, 500)
    },
    [canvasId, requestHeaders]
  )

  const handleMount = useCallback(
    (editor: Editor) => {
      return editor.store.listen(
        () => {
          const nextDocument = editor.getSnapshot().document
          void scheduleSave(nextDocument)
        },
        { source: 'user', scope: 'document' }
      )
    },
    [scheduleSave]
  )

  return {
    snapshot,
    hasServerDocument,
    loading,
    error,
    handleMount,
  }
}
