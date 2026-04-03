'use client'

// Design DNA Panel V2 — medium-aware, two-tab panel with state machine.
// States: idle → needs_medium → extracting → ready → error
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { createPortal } from 'react-dom'
import { useEditor, createShapeId, TLShapeId, TldrawUiIcon } from 'tldraw'
import { motion } from 'framer-motion'
import { X, RefreshCw, Pencil, Sparkles, FileDown, RotateCcw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Medium, WebAppDNA, ImageGenDNA } from '@/types/dna'
import { getBoardArtifactCount, getBoardImageUrls } from '@/lib/getBoardImages'
import { useTheme } from '@/context/ThemeContext'
import { buildThemeFromWebDna } from '@/lib/themeFromDna'
import { MediumPicker } from './MediumPicker'
import { DesignerView } from './DesignerView'
import { ExportView } from './ExportView'

type PanelState = 'idle' | 'needs_medium' | 'extracting' | 'ready' | 'error'

function getBoardLoadKey(boardName: string, boardId?: string, frameShapeId?: TLShapeId) {
  return `${boardId || 'no-board-id'}::${frameShapeId || 'no-frame'}::${boardName}`
}

interface DNAPanelV2Props {
  boardName: string
  boardId?: string
  frameShapeId?: TLShapeId
  canvasId: string
  isOpen: boolean
  onClose: () => void
  onExtractionStateChange?: (isExtracting: boolean) => void
  accessToken?: string | null
}

export function DNAPanelV2({
  boardName,
  boardId: initialBoardId,
  frameShapeId,
  canvasId,
  isOpen,
  onClose,
  onExtractionStateChange,
  accessToken,
}: DNAPanelV2Props) {
  const editor = useEditor()
  const { setTheme, resetTheme, isDefaultTheme } = useTheme()
  const [state, setState] = useState<PanelState>('idle')
  const [boardId, setBoardId] = useState<string | null>(initialBoardId || null)
  const [medium, setMedium] = useState<Medium | null>(null)
  const [useCase, setUseCase] = useState<string>('')
  const [dna, setDna] = useState<WebAppDNA | ImageGenDNA | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [analyzableVisualCount, setAnalyzableVisualCount] = useState(0)
  const [artifactCount, setArtifactCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('designer')
  const [sourceContext, setSourceContext] = useState<string>('')
  const [appealContext, setAppealContext] = useState<string>('')
  const [observations, setObservations] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showRegenPrompt, setShowRegenPrompt] = useState(false)
  const [regenReason, setRegenReason] = useState('')
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  // Track which board identity we last loaded to avoid redundant fetches
  const [loadedBoardKey, setLoadedBoardKey] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? accessToken ?? null
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }, [accessToken])

  const syncResolvedBoard = useCallback(
    (resolvedBoardId: string | null | undefined) => {
      if (!resolvedBoardId) return

      setBoardId((currentBoardId) => currentBoardId || resolvedBoardId)

      if (!frameShapeId) return

      const frame = editor.getShape(frameShapeId)
      const currentBoardId = (frame?.meta as { boardId?: string } | undefined)?.boardId

      if (frame?.type === 'frame' && currentBoardId !== resolvedBoardId) {
        editor.updateShape({
          id: frameShapeId,
          type: 'frame',
          meta: { ...(frame.meta || {}), boardId: resolvedBoardId },
        })
      }

      getAuthHeaders().then((authHeaders) => {
        fetch('/api/boards', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ canvasId, boardId: resolvedBoardId, frameShapeId }),
        }).catch(() => {})
      }).catch(() => {})
    },
    [canvasId, editor, frameShapeId, getAuthHeaders]
  )

  useEffect(() => {
    setBoardId(initialBoardId || null)
  }, [initialBoardId])

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  useEffect(() => {
    onExtractionStateChange?.(state === 'extracting')
    return () => {
      onExtractionStateChange?.(false)
    }
  }, [onExtractionStateChange, state])

  // Intercept clipboard and keyboard events at the native DOM level to prevent
  // tldraw's document-level listeners from capturing copy/paste inside the panel.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    const stopNative = (e: Event) => e.stopPropagation()
    const stopKeyboard = (e: KeyboardEvent) => {
      // Let all keyboard events inside the panel stay in the panel
      // This prevents tldraw from intercepting Ctrl+C/V/X and other shortcuts
      e.stopPropagation()
    }

    el.addEventListener('copy', stopNative, true)
    el.addEventListener('cut', stopNative, true)
    el.addEventListener('paste', stopNative, true)
    el.addEventListener('keydown', stopKeyboard, true)
    el.addEventListener('keyup', stopKeyboard, true)

    return () => {
      el.removeEventListener('copy', stopNative, true)
      el.removeEventListener('cut', stopNative, true)
      el.removeEventListener('paste', stopNative, true)
      el.removeEventListener('keydown', stopKeyboard, true)
      el.removeEventListener('keyup', stopKeyboard, true)
    }
  }, [])

  // Fetch board data when boardName changes to a DIFFERENT board
  useEffect(() => {
    // Same board — skip fetch, keep existing state
    const boardLoadKey = getBoardLoadKey(boardName, initialBoardId, frameShapeId)
    if (boardLoadKey === loadedBoardKey) return

    // Different board — reset and fetch
    setLoadedBoardKey(boardLoadKey)
    setState('idle')
    setBoardId(initialBoardId || null)
    setMedium(null)
    setUseCase('')
    setDna(null)
    setError(null)
    setActiveTab('designer')
    setSourceContext('')
    setAppealContext('')
    setObservations(null)
    setFeedback(null)
    setShowRegenPrompt(false)
    setRegenReason('')

    // Get image URLs from the frame
    const urls = getBoardImageUrls(editor, { boardId: initialBoardId, frameId: frameShapeId, frameName: boardName })
    const count = getBoardArtifactCount(editor, { boardId: initialBoardId, frameId: frameShapeId, frameName: boardName })
    setImageUrls(urls)
    setAnalyzableVisualCount(urls.length)
    setArtifactCount(count)

    const loadBoard = async () => {
      let resolvedBoardId = initialBoardId || null
      const authHeaders = await getAuthHeaders()

      if (frameShapeId) {
        try {
          const repairResponse = await fetch('/api/boards/repair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              canvasId,
              boardId: resolvedBoardId,
              frameShapeId,
              frameName: boardName,
            }),
          })

          if (repairResponse.ok) {
            const repairData = (await repairResponse.json()) as { id?: string }
            if (repairData.id) {
              resolvedBoardId = repairData.id
            }
          }
        } catch {}
      }

      const params = new URLSearchParams({ canvasId })
      if (resolvedBoardId) params.set('boardId', resolvedBoardId)
      if (frameShapeId) params.set('frameShapeId', frameShapeId)
      params.set('name', boardName)

      fetch(`/api/boards?${params.toString()}`, {
        headers: { ...authHeaders },
      })
        .then((res) => {
          if (!res.ok) throw new Error('Board not found')
          return res.json()
        })
        .then((data) => {
          setBoardId(data.id)
          if (frameShapeId) {
            const frame = editor.getShape(frameShapeId)
            const currentBoardId = (frame?.meta as { boardId?: string } | undefined)?.boardId
            if (frame?.type === 'frame' && currentBoardId !== data.id) {
              editor.updateShape({
                id: frameShapeId,
                type: 'frame',
                meta: { ...(frame.meta || {}), boardId: data.id },
              })
            }

            if (data.frame_shape_id !== frameShapeId) {
              fetch('/api/boards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ canvasId, boardId: data.id, frameShapeId }),
              }).catch(() => {})
            }
          }

          if (data.name !== boardName) {
            fetch('/api/boards', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ canvasId, boardId: data.id, newName: boardName }),
            }).catch(() => {})
          }

          if (data.needs_extraction) {
            setState('needs_medium')
          } else {
            setMedium(data.medium)
            setUseCase(data.use_case || '')
            setSourceContext(data.source_context || '')
            setAppealContext(data.appeal_context || '')
            setDna(data.dna_data)
            setObservations(data.observations || null)
            setState('ready')
          }

          if (data.id) {
            fetch(`/api/dna-feedback?boardId=${data.id}`, {
              headers: { ...authHeaders },
            })
              .then((res) => res.json())
              .then((fb) => {
                if (fb?.what_was_off) setFeedback(fb.what_was_off)
              })
              .catch(() => {})
          }
        })
        .catch(() => {
          setState('needs_medium')
        })
    }

    void loadBoard()
  }, [boardName, canvasId, editor, frameShapeId, getAuthHeaders, initialBoardId, loadedBoardKey])

  const extractDNA = useCallback(
    async (selectedMedium: Medium, selectedUseCase: string, selectedSourceContext?: string, selectedAppealContext?: string) => {
      if (!boardName) return
      if (imageUrls.length === 0) {
        setError('This board has no analyzable visuals yet. Add images, or use links with preview images.')
        setState('error')
        return
      }

      setState('extracting')
      setMedium(selectedMedium)
      setUseCase(selectedUseCase)
      if (selectedSourceContext !== undefined) setSourceContext(selectedSourceContext)
      if (selectedAppealContext !== undefined) setAppealContext(selectedAppealContext)
      setError(null)

      try {
        const response = await fetch('/api/extract-dna', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...await getAuthHeaders() },
          body: JSON.stringify({
            boardId,
            boardName,
            canvasId,
            frameShapeId,
            medium: selectedMedium,
            useCase: selectedUseCase || undefined,
            sourceContext: selectedSourceContext || undefined,
            appealContext: selectedAppealContext || undefined,
            imageUrls,
            feedback: feedback || undefined,
          }),
          signal: AbortSignal.timeout(120000),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Extraction failed')
        }

        const result = await response.json() as {
          boardId?: string
          dna: WebAppDNA | ImageGenDNA
          observations?: string | null
        }
        syncResolvedBoard(result.boardId)
        setDna(result.dna)
        setObservations(result.observations || null)
        setState('ready')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Extraction failed')
        setState('error')
      }
    },
    [boardId, boardName, canvasId, frameShapeId, getAuthHeaders, imageUrls, feedback, syncResolvedBoard]
  )

  const handleRegenerate = useCallback((reason?: string) => {
    if (!medium || !boardName) return
    if (imageUrls.length === 0) {
      setError('This board has no analyzable visuals yet. Add images, or use links with preview images.')
      setState('error')
      return
    }

    // Pass feedback directly into the extraction request instead of relying on state
    setShowRegenPrompt(false)
    setRegenReason('')
    setState('extracting')
    setError(null)

    const feedbackText = reason || feedback || undefined

    getAuthHeaders().then((authHeaders) => {
      fetch('/api/extract-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          boardId,
          boardName,
          canvasId,
          frameShapeId,
          medium,
          useCase: useCase || undefined,
          sourceContext: sourceContext || undefined,
          appealContext: appealContext || undefined,
          imageUrls,
          observations: observations || undefined,
          feedback: feedbackText,
          previousDna: feedbackText ? dna : undefined,
        }),
        signal: AbortSignal.timeout(120000),
      })
      .then((res) => {
        if (!res.ok) return res.json().then((err) => { throw new Error(err.error || 'Extraction failed') })
        return res.json()
      })
      .then((result: { boardId?: string; dna: WebAppDNA | ImageGenDNA; observations?: string | null }) => {
        syncResolvedBoard(result.boardId)
        setDna(result.dna)
        setObservations(result.observations || null)
        if (reason) setFeedback(reason)
        setState('ready')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Extraction failed')
        setState('error')
      })
    }).catch(() => {
      setState('error')
    })
  }, [boardId, medium, boardName, canvasId, frameShapeId, getAuthHeaders, useCase, sourceContext, appealContext, observations, imageUrls, feedback, dna, syncResolvedBoard])

  const handleDetach = useCallback(() => {
    if (!dna || !medium || !boardName) return

    // Find the frame on canvas to position snapshot nearby
    const frame = frameShapeId ? editor.getShape(frameShapeId) : null
    const offsetX = frame ? frame.x + ((frame.props as { w?: number }).w || 0) + 40 : 200
    const offsetY = frame ? frame.y : 200

    // Build snapshot data based on medium
    let colorHexes: string[] = []
    let fontInfo = ''
    if (medium === 'web') {
      const w = dna as WebAppDNA
      colorHexes = w.color_palette.colors.map((c) => c.hex)
      fontInfo = `${w.typography.display.family} / ${w.typography.body.family}`
    } else {
      const ig = dna as ImageGenDNA
      colorHexes = ig.color_palette.colors
      fontInfo = `${ig.medium_type.primary} · ${ig.lighting.slice(0, 2).join(', ')}`
    }

    const snapshotId = createShapeId()
    editor.createShape({
      id: snapshotId,
      type: 'snapshot-card',
      x: offsetX,
      y: offsetY,
      props: {
        w: 240,
        h: 320,
        boardId: boardId || '',
        boardName,
        medium,
        directionSummary: dna.direction_summary || '',
        moodTags: JSON.stringify(dna.mood_tags || []),
        antiPatterns: JSON.stringify(dna.anti_patterns || []),
        colorHexes: JSON.stringify(colorHexes),
        fontInfo,
      },
    })
  }, [boardId, dna, medium, boardName, editor, frameShapeId])

  const panelContent = (
    <motion.div
      ref={panelRef}
      key="dna-panel"
      initial={false}
      animate={{
        x: isOpen ? 0 : '100%',
        opacity: isOpen ? 1 : 0.96,
      }}
      transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
      className="grain-dna-panel fixed top-0 right-0 w-1/3 min-w-80 h-screen flex flex-col"
      style={{
        // Mount outside tldraw's strict layout stacking context so the panel
        // can reliably sit above contextual toolbars and other canvas chrome.
        zIndex: 1201,
        pointerEvents: isOpen ? 'all' : 'none',
        touchAction: 'auto',
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-panel)',
        borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text)',
        visibility: isOpen ? 'visible' : 'hidden',
      }}
      aria-hidden={!isOpen}
      // Prevent pointer events from reaching tldraw canvas
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-4 pt-4 pb-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {dna && medium === 'web' && (dna as WebAppDNA).color_palette?.colors?.[0] && (
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: (dna as WebAppDNA).color_palette.colors[0].hex }}
            />
          )}
          {dna && medium === 'image' && (dna as ImageGenDNA).color_palette?.colors?.[0] && (
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: (dna as ImageGenDNA).color_palette.colors[0] }}
            />
          )}
          <span className="text-[13px] font-semibold uppercase tracking-wider truncate">
            {boardName}
          </span>
        </div>
        <div className="flex gap-1">
          {!isDefaultTheme && (
            <PanelIconButton title="Reset to default theme" onClick={() => {
              resetTheme()
            }}>
              <RotateCcw size={14} />
            </PanelIconButton>
          )}
          <PanelIconButton title="Detach as snapshot" onClick={handleDetach}>
            <TldrawUiIcon icon="tool-screenshot" label="Detach as snapshot" />
          </PanelIconButton>
          <PanelIconButton title="Close" onClick={() => { editor.selectNone(); onClose() }}>
            <X size={14} />
          </PanelIconButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {state === 'needs_medium' && (
          <MediumPicker
            onSubmit={extractDNA}
            artifactCount={artifactCount}
            analyzableVisualCount={analyzableVisualCount}
          />
        )}

        {state === 'extracting' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-6">
              <RefreshCw size={20} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent)' }} />
              <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Extracting Design DNA...
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                Observing {imageUrls.length} visual reference{imageUrls.length !== 1 ? 's' : ''}, then synthesizing DNA.
                This usually takes 20-30 seconds.
              </p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <p className="text-[13px] mb-3" style={{ color: 'var(--color-muted)' }}>
                {error || 'Something went wrong'}
              </p>
              <button
                onClick={() => setState('needs_medium')}
                className="text-[12px] px-3 py-1.5 rounded-md cursor-pointer"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {state === 'ready' && dna && medium && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="mx-4 mt-3 mb-0 shrink-0">
              <TabsTrigger value="designer">Designer</TabsTrigger>
              <TabsTrigger value="export">AI Export</TabsTrigger>
            </TabsList>
            <TabsContent value="designer" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <DesignerView
                    medium={medium}
                    dna={dna}
                    imageUrls={imageUrls}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="export" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ExportView
                    medium={medium}
                    dna={dna}
                    useCase={useCase}
                    boardId={boardId}
                    imageUrls={imageUrls}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Regenerate prompt */}
      {showRegenPrompt && (
        <div
          className="p-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <label className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
            What should be different?
          </label>
          <textarea
            value={regenReason}
            onChange={(e) => setRegenReason(e.target.value)}
            placeholder="e.g. Colors too muted, fonts don't match, too corporate..."
            rows={2}
            className="w-full text-[12px] p-2 resize-none rounded-md"
            style={{
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-family)',
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleRegenerate(regenReason || undefined)}
              className="flex-1 text-[12px] py-1.5 rounded-md cursor-pointer"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-surface)',
                border: 'none',
              }}
            >
              Regenerate
            </button>
            <button
              onClick={() => setShowRegenPrompt(false)}
              className="text-[12px] py-1.5 px-3 rounded-md cursor-pointer"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-muted)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {state === 'ready' && dna && !showRegenPrompt && (
        <div
          className="grid grid-cols-2 gap-2 p-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <ActionButton icon={<RefreshCw size={13} />} onClick={() => setShowRegenPrompt(true)}>
            Regenerate
          </ActionButton>
          <ActionButton icon={<Pencil size={13} />} onClick={() => alert('Coming soon')}>
            Edit DNA
          </ActionButton>
          {medium === 'web' && (
            <ActionButton icon={<Sparkles size={13} />} onClick={() => {
              const webDna = dna as WebAppDNA
              setTheme(buildThemeFromWebDna(webDna))
            }}>
              Apply to Grain
            </ActionButton>
          )}
          <ActionButton icon={<FileDown size={13} />} onClick={() => setActiveTab('export')}>
            Export DNA
          </ActionButton>
        </div>
      )}
    </motion.div>
  )

  if (!portalTarget) return null

  return createPortal(panelContent, portalTarget)
}

function PanelIconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1 rounded-sm cursor-pointer flex items-center hover:bg-[var(--color-border)]"
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--color-muted)',
      }}
    >
      {children}
    </button>
  )
}

function ActionButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 py-2 px-3 text-[12px] cursor-pointer"
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {icon}
      {children}
    </button>
  )
}
