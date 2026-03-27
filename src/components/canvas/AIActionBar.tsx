'use client'

// AI Action Bar — replaces the default selection toolbar.
// Shows sparkle icon on any selection. Hover expands to suggestions + text input.
// Sends messages to /api/canvas-ai and executes tool calls against the editor.

import { useState, useCallback, useRef, useEffect } from 'react'
import { useEditor, useValue, TLShapeId, createShapeId } from 'tldraw'
import { Sparkles, Download, Send } from 'lucide-react'
import { buildSelectionContext } from '@/lib/selection-context'
import { executeToolCalls } from '@/lib/canvas-ai-executor'
import type { CanvasAIResponse, AISuggestion } from '@/types/canvas-ai'
import { AIThinkingIndicator } from './AIThinkingIndicator'

interface AIActionBarProps {
  canvasId: string
  onExtractDna?: () => void
  forceExpanded?: boolean
  onForceExpandedConsumed?: () => void
}

// Contextual suggestions based on selection type
function getSuggestions(
  selectionType: string,
  imageCount: number,
  isUngrouped: boolean,
  boardCount: number
): AISuggestion[] {
  if (selectionType === 'image' && imageCount === 1 && isUngrouped) {
    return [
      { label: 'What is this?', message: 'What is this image?' },
      { label: 'Describe', message: 'Describe this image in detail' },
    ]
  }
  if (selectionType === 'image' && imageCount === 1 && !isUngrouped) {
    return [
      { label: 'Describe', message: 'Describe this image' },
    ]
  }
  if (selectionType === 'image' && imageCount >= 2) {
    return [
      { label: 'Group as board', message: 'Group these images into a board with a descriptive name' },
      { label: 'What do these have in common?', message: 'What do these images have in common?' },
    ]
  }
  if (selectionType === 'board' && boardCount === 1) {
    return [
      { label: 'Extract DNA', message: 'Extract DNA from this board' },
      { label: 'Rename', message: 'Suggest a better name for this board based on its images' },
    ]
  }
  if (selectionType === 'board' && boardCount >= 2) {
    return [
      { label: 'Compare', message: 'Compare these boards — what makes each unique?' },
      { label: "What's different?", message: "What's different between these boards?" },
    ]
  }
  return []
}

export function AIActionBar({ canvasId, onExtractDna, forceExpanded, onForceExpandedConsumed }: AIActionBarProps) {
  const editor = useEditor()
  const [expanded, setExpanded] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [thinkingStatus, setThinkingStatus] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track if anything is selected
  const hasSelection = useValue(
    'hasSelection',
    () => editor.getSelectedShapes().length > 0,
    [editor]
  )

  // Get selection info for suggestions
  const selectionInfo = useValue(
    'selectionInfo',
    () => {
      const selected = editor.getSelectedShapes()
      const images = selected.filter((s) => s.type === 'image')
      const boards = selected.filter((s) => s.type === 'frame')
      const ungrouped = images.filter((s) => {
        const parent = editor.getShape(s.parentId as TLShapeId)
        return !parent || parent.type !== 'frame'
      })

      let type = 'none'
      if (images.length > 0 && boards.length > 0) type = 'mixed'
      else if (images.length > 0) type = 'image'
      else if (boards.length > 0) type = 'board'
      else if (selected.length > 0) type = 'shapes'

      return {
        type,
        imageCount: images.length,
        isUngrouped: ungrouped.length === images.length,
        boardCount: boards.length,
      }
    },
    [editor]
  )

  // Get bar position (above selection)
  const barPosition = useValue(
    'aiBarPosition',
    () => {
      const bounds = editor.getSelectionPageBounds()
      if (!bounds) return null
      return editor.pageToViewport({ x: bounds.midX, y: bounds.minY })
    },
    [editor]
  )

  // Handle right-click "Ask AI..." trigger
  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true)
      onForceExpandedConsumed?.()
    }
  }, [forceExpanded, onForceExpandedConsumed])

  // Close on click outside
  useEffect(() => {
    if (!expanded) return
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setInputValue('')
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [expanded])

  // Focus input when expanded
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [expanded])

  // Close when selection changes
  useEffect(() => {
    setExpanded(false)
    setInputValue('')
    setShowDeleteConfirm(false)
  }, [selectionInfo.type, selectionInfo.imageCount, selectionInfo.boardCount])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isProcessing) return

    setIsProcessing(true)
    setThinkingStatus('Thinking...')
    setExpanded(false)
    setInputValue('')

    try {
      const context = buildSelectionContext(editor)

      const res = await fetch('/api/canvas-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, canvasId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Request failed')
      }

      const data: CanvasAIResponse = await res.json()

      if (data.error) throw new Error(data.error)

      // Execute tool calls
      if (data.toolCalls.length > 0) {
        setThinkingStatus('Executing...')
        const results = await executeToolCalls(editor, data.toolCalls, canvasId)

        // Handle special results
        for (const result of results) {
          if (result.triggerExtractDna && onExtractDna) {
            onExtractDna()
          }
          if (result.needsDeleteConfirmation) {
            setShowDeleteConfirm(true)
          }
        }
      }
    } catch (error) {
      console.error('Canvas AI error:', error)
      // Place error text on canvas
      const bounds = editor.getSelectionPageBounds()
      if (bounds) {
        editor.createShape({
          id: createShapeId(),
          type: 'ai-text',
          x: bounds.maxX + 24,
          y: bounds.minY,
          props: {
            w: 280,
            h: 40,
            text: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
          },
        })
      }
    } finally {
      setIsProcessing(false)
      setThinkingStatus('')
    }
  }, [editor, canvasId, isProcessing, onExtractDna])

  const handleDeleteConfirm = useCallback(() => {
    editor.deleteShapes(editor.getSelectedShapeIds())
    setShowDeleteConfirm(false)
  }, [editor])

  // When nothing is selected but forceExpanded (right-click "Ask AI..."), show floating input
  const isFloatingMode = !hasSelection && expanded

  if (!hasSelection && !expanded && !isProcessing) return null

  // Show thinking indicator while processing
  if (isProcessing) {
    if (barPosition) {
      return <AIThinkingIndicator status={thinkingStatus} />
    }
    // Floating thinking indicator when no selection
    return (
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '40%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-toolbar)',
          fontFamily: 'var(--font-family)',
          fontSize: 12,
          color: 'var(--color-muted)',
          pointerEvents: 'none',
        }}
      >
        <Sparkles size={13} style={{ color: 'var(--color-accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        {thinkingStatus}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      </div>
    )
  }

  // Show delete confirmation
  if (showDeleteConfirm && barPosition) {
    return (
      <div
        style={{
          position: 'fixed',
          left: barPosition.x,
          top: barPosition.y - 12,
          transform: 'translate(-50%, -100%)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-toolbar)',
          fontFamily: 'var(--font-family)',
          fontSize: 12,
          pointerEvents: 'auto',
        }}
      >
        <span style={{ color: 'var(--color-text)' }}>Delete selection?</span>
        <button
          onClick={handleDeleteConfirm}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#b44040',
            color: '#fff',
            border: 'none',
            fontSize: 11,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
        <button
          onClick={() => setShowDeleteConfirm(false)}
          style={{
            padding: '3px 10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-muted)',
            border: '1px solid var(--color-border)',
            fontSize: 11,
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  const suggestions = getSuggestions(
    selectionInfo.type,
    selectionInfo.imageCount,
    selectionInfo.isUngrouped,
    selectionInfo.boardCount
  )

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        ...(isFloatingMode
          ? { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }
          : barPosition
            ? { left: barPosition.x, top: barPosition.y - 12, transform: 'translate(-50%, -100%)' }
            : { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }),
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'auto',
      }}
    >
      {expanded ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '8px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-toolbar)',
            fontFamily: 'var(--font-family)',
            minWidth: 240,
          }}
        >
          {/* Suggestion chips */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.message)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    fontSize: 11,
                    fontFamily: 'var(--font-family)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'
                  }}
                >
                  <Sparkles size={10} style={{ color: 'var(--color-accent)' }} />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  sendMessage(inputValue)
                }
                // Stop propagation to prevent tldraw from handling keyboard events
                e.stopPropagation()
              }}
              placeholder="Ask AI..."
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                fontSize: 12,
                fontFamily: 'var(--font-family)',
                outline: 'none',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-accent)'
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--color-border)'
              }}
            />
            <button
              onClick={() => inputValue.trim() && sendMessage(inputValue)}
              disabled={!inputValue.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-md)',
                backgroundColor: inputValue.trim() ? 'var(--color-accent)' : 'var(--color-bg)',
                color: inputValue.trim() ? '#fff' : 'var(--color-muted)',
                border: 'none',
                cursor: inputValue.trim() ? 'pointer' : 'default',
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-toolbar)',
          }}
        >
          {/* Download button (kept from original toolbar) */}
          <button
            onClick={() => {
              // Download not yet implemented for tldraw v4
              console.log('Download not yet implemented for tldraw v4')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Download selection"
          >
            <Download size={14} />
          </button>

          {/* AI sparkle icon — click to expand */}
          <button
            onClick={() => setExpanded(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent',
              color: 'var(--color-accent)',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Ask AI"
          >
            <Sparkles size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
