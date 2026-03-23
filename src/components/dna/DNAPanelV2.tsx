'use client'

// Design DNA Panel V2 — medium-aware, two-tab panel with state machine.
// States: idle → needs_medium → extracting → ready → error
// Reference: grain-prd.md Section 11.3

import { useState, useEffect, useCallback } from 'react'
import { useEditor, createShapeId, TLShapeId } from 'tldraw'
import { motion } from 'framer-motion'
import { X, GripVertical, RefreshCw, Pencil, Sparkles, FileDown, RotateCcw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Medium, WebAppDNA, ImageGenDNA } from '@/types/dna'
import { getBoardImageUrls } from '@/lib/getBoardImages'
import { useTheme } from '@/context/ThemeContext'
import { GrainTheme, defaultTheme } from '@/config/theme'
import { buildGoogleFontUrl } from '@/lib/google-fonts'
import { MediumPicker } from './MediumPicker'
import { DesignerView } from './DesignerView'
import { ExportView } from './ExportView'

type PanelState = 'idle' | 'needs_medium' | 'extracting' | 'ready' | 'error'

interface DNAPanelV2Props {
  boardName: string
  canvasId: string
  onClose: () => void
}

export function DNAPanelV2({ boardName, canvasId, onClose }: DNAPanelV2Props) {
  const editor = useEditor()
  const { setTheme, resetTheme } = useTheme()
  const [state, setState] = useState<PanelState>('idle')
  const [boardId, setBoardId] = useState<string | null>(null)
  const [medium, setMedium] = useState<Medium | null>(null)
  const [useCase, setUseCase] = useState<string>('')
  const [dna, setDna] = useState<WebAppDNA | ImageGenDNA | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('designer')
  const [sourceContext, setSourceContext] = useState<string>('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [themeApplied, setThemeApplied] = useState(false)
  const [showRegenPrompt, setShowRegenPrompt] = useState(false)
  const [regenReason, setRegenReason] = useState('')
  // Track which board we last loaded to avoid redundant fetches
  const [loadedBoardName, setLoadedBoardName] = useState<string | null>(null)

  // Fetch board data when boardName changes to a DIFFERENT board
  useEffect(() => {
    // Same board — skip fetch, keep existing state
    if (boardName === loadedBoardName) return

    // Different board — reset and fetch
    setLoadedBoardName(boardName)

    // Get image URLs from the frame
    const urls = getBoardImageUrls(editor, boardName)
    setImageUrls(urls)

    // Fetch board from API
    fetch(`/api/boards?name=${encodeURIComponent(boardName)}&canvasId=${encodeURIComponent(canvasId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Board not found')
        return res.json()
      })
      .then((data) => {
        setBoardId(data.id)
        if (data.needs_extraction) {
          setState('needs_medium')
        } else {
          setMedium(data.medium)
          setUseCase(data.use_case || '')
          setDna(data.dna_data)
          setState('ready')
        }

        // Fetch feedback now that we have the board ID
        if (data.id) {
          fetch(`/api/dna-feedback?boardId=${data.id}`)
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
  }, [boardName, canvasId, editor, loadedBoardName])

  const extractDNA = useCallback(
    async (selectedMedium: Medium, selectedUseCase: string, selectedSourceContext?: string) => {
      if (!boardName || imageUrls.length === 0) return

      setState('extracting')
      setMedium(selectedMedium)
      setUseCase(selectedUseCase)
      if (selectedSourceContext !== undefined) setSourceContext(selectedSourceContext)
      setError(null)

      try {
        const response = await fetch('/api/extract-dna', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            boardName,
            canvasId,
            medium: selectedMedium,
            useCase: selectedUseCase || undefined,
            sourceContext: selectedSourceContext || undefined,
            imageUrls,
            feedback: feedback || undefined,
          }),
          signal: AbortSignal.timeout(60000),
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err.error || 'Extraction failed')
        }

        const result = await response.json()
        setDna(result.dna)
        setState('ready')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Extraction failed')
        setState('error')
      }
    },
    [boardName, canvasId, imageUrls, feedback]
  )

  const handleRegenerate = useCallback((reason?: string) => {
    if (!medium || !boardName || imageUrls.length === 0) return

    // Pass feedback directly into the extraction request instead of relying on state
    setShowRegenPrompt(false)
    setRegenReason('')
    setState('extracting')
    setError(null)

    const feedbackText = reason || feedback || undefined

    fetch('/api/extract-dna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardName,
        canvasId,
        medium,
        useCase: useCase || undefined,
        sourceContext: sourceContext || undefined,
        imageUrls,
        feedback: feedbackText,
        previousDna: feedbackText ? dna : undefined,
      }),
      signal: AbortSignal.timeout(60000),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((err) => { throw new Error(err.error || 'Extraction failed') })
        return res.json()
      })
      .then((result) => {
        setDna(result.dna)
        if (reason) setFeedback(reason)
        setState('ready')
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Extraction failed')
        setState('error')
      })
  }, [medium, boardName, canvasId, useCase, sourceContext, imageUrls, feedback])

  const handleDetach = useCallback(() => {
    if (!dna || !medium || !boardName) return

    // Find the frame on canvas to position snapshot nearby
    const allShapes = editor.getCurrentPageShapes()
    const frame = allShapes.find(
      (s) => s.type === 'frame' && (s.props as { name?: string }).name === boardName
    )
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
        boardName,
        medium,
        directionSummary: dna.direction_summary || '',
        moodTags: JSON.stringify(dna.mood_tags || []),
        antiPatterns: JSON.stringify(dna.anti_patterns || []),
        colorHexes: JSON.stringify(colorHexes),
        fontInfo,
      },
    })
  }, [dna, medium, boardName, editor])

  return (
    <motion.div
      key="dna-panel"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
      className="grain-dna-panel fixed top-0 right-0 w-1/3 min-w-80 h-screen flex flex-col z-1000"
      style={{
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-panel)',
        borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text)',
      }}
      // Prevent events from reaching tldraw canvas
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onCopy={(e) => e.stopPropagation()}
      onCut={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
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
          {themeApplied && (
            <PanelIconButton title="Reset to default theme" onClick={() => {
              resetTheme()
              setThemeApplied(false)
            }}>
              <RotateCcw size={14} />
            </PanelIconButton>
          )}
          <PanelIconButton title="Detach as snapshot" onClick={handleDetach}>
            <GripVertical size={14} />
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
            imageCount={imageUrls.length}
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
                Analyzing {imageUrls.length} image{imageUrls.length !== 1 ? 's' : ''} with Claude Sonnet.
                This usually takes 10-20 seconds.
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
              const colorMap: Record<string, string> = {}
              for (const c of webDna.color_palette.colors) {
                colorMap[c.role] = c.hex
              }
              const r = webDna.border_radius
              const shadowMap: Record<string, GrainTheme['shadows']> = {
                none: { toolbar: 'none', card: 'none', panel: 'none', cursor: 'none' },
                subtle: defaultTheme.shadows,
                layered: {
                  toolbar: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                  card: '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
                  panel: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  cursor: '0 4px 16px rgba(0,0,0,0.10)',
                },
                elevated: {
                  toolbar: '0 8px 32px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08)',
                  card: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
                  panel: '0 12px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
                  cursor: '0 8px 24px rgba(0,0,0,0.12)',
                },
              }
              setTheme({
                colors: {
                  bg: colorMap.light || defaultTheme.colors.bg,
                  surface: colorMap.light || defaultTheme.colors.surface,
                  accent: colorMap.primary || defaultTheme.colors.accent,
                  text: colorMap.dark || defaultTheme.colors.text,
                  muted: colorMap.secondary || defaultTheme.colors.muted,
                  border: colorMap.secondary || defaultTheme.colors.border,
                },
                typography: {
                  fontFamily: webDna.typography.display.family,
                  fontUrl: buildGoogleFontUrl([
                    { family: webDna.typography.display.family, weights: [webDna.typography.display.weight] },
                    { family: webDna.typography.body.family, weights: [webDna.typography.body.weight] },
                  ]),
                },
                radius: {
                  sm: `${Math.round(r / 2)}px`,
                  md: `${r}px`,
                  lg: `${Math.round(r * 1.5)}px`,
                  xl: `${r * 2}px`,
                },
                shadows: shadowMap[webDna.shadow_style] || defaultTheme.shadows,
              })
              setThemeApplied(true)
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
