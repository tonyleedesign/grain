'use client'

import { useState, useMemo } from 'react'
import { Copy, Check, FileText, Sparkles, Download } from 'lucide-react'
import type { Medium, WebAppDNA, ImageGenDNA } from '@/types/dna'
import { formatForCodeTools, formatForMidjourney, formatReadme, formatStyle, formatComposition, formatAssets } from '@/lib/export-formatters'
import { downloadPackage } from '@/lib/download-package'
import { FeedbackPrompt } from './FeedbackPrompt'

type WebFileTab = 'readme' | 'style' | 'composition' | 'assets'

interface ExportViewProps {
  medium: Medium
  dna: WebAppDNA | ImageGenDNA
  useCase: string
  boardId: string | null
  imageUrls: string[]
}

export function ExportView({ medium, dna, useCase, boardId, imageUrls }: ExportViewProps) {
  if (medium === 'image') {
    return <ImageExportView dna={dna as ImageGenDNA} useCase={useCase} boardId={boardId} />
  }
  return <WebExportView dna={dna as WebAppDNA} useCase={useCase} boardId={boardId} imageUrls={imageUrls} />
}

// --- Image medium: unchanged from current behavior ---

function ImageExportView({ dna, useCase, boardId }: { dna: ImageGenDNA; useCase: string; boardId: string | null }) {
  const [format, setFormat] = useState<'skill' | 'midjourney'>('skill')
  const [copied, setCopied] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  const output = format === 'skill'
    ? formatForCodeTools(dna, 'image', useCase || undefined)
    : formatForMidjourney(dna, useCase || undefined)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setShowFeedback(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Sparkles size={12} style={{ color: 'var(--color-accent)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>
          {format === 'skill' ? 'Design Skill — paste into any AI tool' : 'Midjourney Prompt'}
        </span>
      </div>

      <div className="flex gap-1 p-0.5 rounded-md" style={{ backgroundColor: 'var(--color-bg)' }}>
        <FormatButton active={format === 'skill'} onClick={() => setFormat('skill')} icon={<FileText size={11} />}>
          Skill.md
        </FormatButton>
        <FormatButton active={format === 'midjourney'} onClick={() => setFormat('midjourney')} icon={<Sparkles size={11} />}>
          Midjourney
        </FormatButton>
      </div>

      <div
        className="text-[10px] px-2 py-1.5 rounded-md leading-relaxed"
        style={{
          color: 'var(--color-muted)',
          backgroundColor: 'var(--color-bg)',
          border: '1px dashed var(--color-border)',
        }}
      >
        {format === 'skill'
          ? 'Copy this into Claude, ChatGPT, Cursor, or any AI coding tool as a system prompt or skill file.'
          : 'Paste directly into Midjourney. Anti-patterns are converted to --no flags.'}
      </div>

      <PreviewBlock content={output} onCopy={handleCopy} copied={copied} />

      {showFeedback && <FeedbackPrompt boardId={boardId} />}
    </div>
  )
}

// --- Web medium: new file tabs UI ---

function WebExportView({ dna, useCase, boardId, imageUrls }: {
  dna: WebAppDNA
  useCase: string
  boardId: string | null
  imageUrls: string[]
}) {
  const [activeTab, setActiveTab] = useState<WebFileTab>('readme')
  const [copied, setCopied] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Initialize checked state from AI classification
  const [checkedImages, setCheckedImages] = useState<boolean[]>(() => {
    return imageUrls.map((_, i) => {
      const role = dna.image_roles?.find(r => r.image_index === i)
      return role?.role === 'usable_asset'
    })
  })

  const checkedIndices = useMemo(
    () => checkedImages.reduce<number[]>((acc, checked, i) => checked ? [...acc, i] : acc, []),
    [checkedImages]
  )

  const hasCheckedImages = checkedIndices.length > 0

  // Generate file contents
  const fileContents = useMemo(() => ({
    readme: formatReadme(dna, useCase || undefined),
    style: formatStyle(dna),
    composition: formatComposition(dna),
    assets: hasCheckedImages ? formatAssets(dna, imageUrls, checkedIndices) : '',
  }), [dna, useCase, imageUrls, checkedIndices, hasCheckedImages])

  const currentContent = fileContents[activeTab]

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentContent)
    setCopied(true)
    setShowFeedback(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPackage({
        dna,
        useCase: useCase || undefined,
        imageUrls,
        checkedIndices,
      })
    } finally {
      setDownloading(false)
      setShowFeedback(true)
    }
  }

  const toggleImage = (index: number) => {
    const next = [...checkedImages]
    next[index] = !next[index]
    setCheckedImages(next)
    // If unchecking last image while on assets tab, switch away
    if (activeTab === 'assets' && !next.some(Boolean)) {
      setActiveTab('readme')
    }
  }

  const tabs: { key: WebFileTab; label: string; disabled?: boolean }[] = [
    { key: 'readme', label: 'README' },
    { key: 'style', label: 'Style' },
    { key: 'composition', label: 'Composition' },
    { key: 'assets', label: 'Assets', disabled: !hasCheckedImages },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles size={12} style={{ color: 'var(--color-accent)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>
          Export Package — {tabs.filter(t => !t.disabled).length} files
        </span>
      </div>

      {/* File tabs */}
      <div className="flex gap-1 p-0.5 rounded-md" style={{ backgroundColor: 'var(--color-bg)' }}>
        {tabs.map(tab => (
          <FormatButton
            key={tab.key}
            active={activeTab === tab.key}
            onClick={() => !tab.disabled && setActiveTab(tab.key)}
            icon={<FileText size={11} />}
            disabled={tab.disabled}
          >
            {tab.label}
          </FormatButton>
        ))}
      </div>

      {/* Usage hint */}
      <div
        className="text-[10px] px-2 py-1.5 rounded-md leading-relaxed"
        style={{
          color: 'var(--color-muted)',
          backgroundColor: 'var(--color-bg)',
          border: '1px dashed var(--color-border)',
        }}
      >
        Preview each file before downloading. Copy individual files or download the full package.
      </div>

      {/* File preview */}
      <PreviewBlock content={currentContent} onCopy={handleCopy} copied={copied} />

      {/* Image checkboxes */}
      {imageUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium px-1" style={{ color: 'var(--color-muted)' }}>
            Include images in export:
          </span>
          <div className="flex gap-2 flex-wrap">
            {imageUrls.map((url, i) => (
              <label
                key={i}
                className="relative cursor-pointer rounded-md overflow-hidden"
                style={{
                  border: `2px solid ${checkedImages[i] ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  opacity: checkedImages[i] ? 1 : 0.5,
                  width: 48,
                  height: 48,
                }}
              >
                <img
                  src={url}
                  alt={`Reference ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <input
                  type="checkbox"
                  checked={checkedImages[i] || false}
                  onChange={() => toggleImage(i)}
                  className="absolute top-0.5 left-0.5"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center justify-center gap-2 py-2 rounded-md cursor-pointer text-[12px] font-medium"
        style={{
          backgroundColor: 'var(--color-accent)',
          color: '#fff',
          border: 'none',
          fontFamily: 'var(--font-family)',
          opacity: downloading ? 0.7 : 1,
        }}
      >
        <Download size={13} />
        {downloading ? 'Downloading...' : `Download Package (${hasCheckedImages ? 4 + checkedIndices.length : 3} files)`}
      </button>

      {/* Feedback */}
      {showFeedback && <FeedbackPrompt boardId={boardId} />}
    </div>
  )
}

// --- Shared components ---

function PreviewBlock({ content, onCopy, copied }: { content: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="relative">
      <pre
        className="text-[11px] leading-relaxed p-3 rounded-md overflow-x-auto whitespace-pre-wrap"
        style={{
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          fontFamily: 'monospace',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {content}
      </pre>
      <button
        onClick={onCopy}
        className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-[11px]"
        style={{
          backgroundColor: copied ? 'var(--color-accent)' : 'var(--color-surface)',
          border: `1px solid ${copied ? 'var(--color-accent)' : 'var(--color-border)'}`,
          color: copied ? '#fff' : 'var(--color-muted)',
          transition: 'all 150ms ease',
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function FormatButton({
  children,
  active,
  onClick,
  icon,
  disabled,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1.5 text-[12px] py-1.5 rounded-md cursor-pointer transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-surface)' : 'transparent',
        color: disabled ? 'var(--color-border)' : active ? 'var(--color-text)' : 'var(--color-muted)',
        border: 'none',
        fontFamily: 'var(--font-family)',
        fontWeight: active ? 500 : 400,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}
      {children}
    </button>
  )
}
