'use client'

// Design DNA Panel — slides in from the right when a board is clicked.
// Displays full DNA extracted by Claude. Reference: grain-prd.md Section 11.3

import { useState, useEffect } from 'react'
import { X, GripVertical, MoreHorizontal, RefreshCw, Pencil, Sparkles, FileDown } from 'lucide-react'

interface BoardDNA {
  id: string
  name: string
  color_palette: { description: string; hex_values: string[] } | null
  core_patterns: string[] | null
  mood_tags: string[] | null
  style_tags: string[] | null
  material_tags: string[] | null
  composition_notes: string | null
  era_reference: string | null
  typography_display: string | null
  typography_body: string | null
  typography_reasoning: string | null
  what_makes_distinct: string | null
}

interface DNAPanelProps {
  boardName: string | null
  canvasId: string
  onClose: () => void
}

export function DNAPanel({ boardName, canvasId, onClose }: DNAPanelProps) {
  const [dna, setDna] = useState<BoardDNA | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!boardName) {
      setDna(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/boards?name=${encodeURIComponent(boardName)}&canvasId=${encodeURIComponent(canvasId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Board not found')
        return res.json()
      })
      .then(setDna)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [boardName, canvasId])

  if (!boardName) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 320,
        height: '100vh',
        backgroundColor: 'var(--color-surface)',
        boxShadow: 'var(--shadow-panel)',
        borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
        zIndex: 1000,
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {dna?.color_palette?.hex_values?.[0] && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: dna.color_palette.hex_values[0],
                flexShrink: 0,
              }}
            />
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {boardName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PanelIconButton title="Board actions">
            <MoreHorizontal size={14} />
          </PanelIconButton>
          <PanelIconButton title="Detach as snapshot">
            <GripVertical size={14} />
          </PanelIconButton>
          <PanelIconButton title="Close" onClick={onClose}>
            <X size={14} />
          </PanelIconButton>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Loading DNA...</p>
        )}
        {error && (
          <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            DNA unavailable. Organize images first.
          </p>
        )}
        {dna && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Color Palette */}
            {dna.color_palette && (
              <Section label="Color palette">
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  {dna.color_palette.hex_values.map((hex, i) => (
                    <ColorSwatch key={i} hex={hex} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>
                  {dna.color_palette.description}
                </p>
              </Section>
            )}

            {/* Core Patterns */}
            {dna.core_patterns && dna.core_patterns.length > 0 && (
              <Section label="Core patterns">
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                  {dna.core_patterns.map((p, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        padding: '2px 0',
                      }}
                    >
                      <span style={{ color: 'var(--color-muted)', marginRight: 6 }}>·</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Mood */}
            {dna.mood_tags && dna.mood_tags.length > 0 && (
              <Section label="Mood">
                <p style={{ fontSize: 13, margin: 0 }}>
                  {dna.mood_tags.join(' · ')}
                </p>
              </Section>
            )}

            {/* Style Tags */}
            {dna.style_tags && dna.style_tags.length > 0 && (
              <Section label="Style tags">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {dna.style_tags.map((tag, i) => (
                    <Tag key={i}>{tag}</Tag>
                  ))}
                </div>
              </Section>
            )}

            {/* Material */}
            {dna.material_tags && dna.material_tags.length > 0 && (
              <Section label="Material">
                <p style={{ fontSize: 13, margin: 0 }}>
                  {dna.material_tags.join(' · ')}
                </p>
              </Section>
            )}

            {/* Composition */}
            {dna.composition_notes && (
              <Section label="Composition">
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {dna.composition_notes}
                </p>
              </Section>
            )}

            {/* Era */}
            {dna.era_reference && (
              <Section label="Era">
                <p style={{ fontSize: 13, margin: 0 }}>{dna.era_reference}</p>
              </Section>
            )}

            {/* Typography */}
            {(dna.typography_display || dna.typography_body) && (
              <Section label="Typography">
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {dna.typography_display && (
                    <div>
                      <span style={{ color: 'var(--color-muted)' }}>Display — </span>
                      {dna.typography_display}
                    </div>
                  )}
                  {dna.typography_body && (
                    <div>
                      <span style={{ color: 'var(--color-muted)' }}>Body — </span>
                      {dna.typography_body}
                    </div>
                  )}
                  {dna.typography_reasoning && (
                    <div style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 4 }}>
                      Why — {dna.typography_reasoning}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* What makes this distinct */}
            {dna.what_makes_distinct && (
              <Section label="What makes this distinct">
                <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {dna.what_makes_distinct}
                </p>
              </Section>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {dna && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <ActionButton icon={<RefreshCw size={13} />}>Regenerate DNA</ActionButton>
          <ActionButton icon={<Pencil size={13} />}>Edit DNA</ActionButton>
          <ActionButton icon={<Sparkles size={13} />}>Apply to Grain</ActionButton>
          <ActionButton icon={<FileDown size={13} />}>Export DNA</ActionButton>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function ColorSwatch({ hex }: { hex: string }) {
  const [showHex, setShowHex] = useState(false)

  return (
    <div
      onMouseEnter={() => setShowHex(true)}
      onMouseLeave={() => setShowHex(false)}
      style={{ position: 'relative' }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: hex,
          border: '1px solid var(--color-border)',
          cursor: 'default',
        }}
      />
      {showHex && (
        <div
          style={{
            position: 'absolute',
            top: -28,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-text)',
            color: 'var(--color-surface)',
            fontSize: 10,
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          {hex}
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--color-bg)',
        fontSize: 12,
        color: 'var(--color-text)',
      }}
    >
      {children}
    </span>
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
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-muted)',
        display: 'flex',
        alignItems: 'center',
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
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: 12,
        fontFamily: 'var(--font-family)',
        cursor: 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  )
}
