# Tier 2: Multi-File Export + Image Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single clipboard export with a 4-file download package (README.md, style.md, composition.md, assets.md) with AI-driven image classification and user override.

**Architecture:** Split the monolithic `formatWebSkill` function into 4 focused formatters. Add `image_roles` to the extraction prompt and WebAppDNA type. Redesign ExportView with file tabs, image checkboxes, and a download button. Image files are downloaded alongside markdown files.

**Tech Stack:** Next.js, React, TypeScript, Lucide icons, CSS variables (project convention — no Tailwind utility classes for colors)

**Spec:** `docs/superpowers/specs/2026-03-25-tier2-folder-export-design.md`

**Verification:** This project has no test framework. Verify each task via `npx tsc --noEmit` (type check) and manual testing in the browser.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/dna.ts` | Modify | Add `image_roles` field to WebAppDNA |
| `src/app/api/extract-dna/prompts.ts` | Modify | Add `image_roles` to JSON schema + extraction rules |
| `src/lib/export-formatters.ts` | Modify | Split `formatWebSkill` into 4 focused formatters |
| `src/lib/download-package.ts` | Create | Download utility (markdown + image blob downloads) |
| `src/components/dna/ExportView.tsx` | Rewrite | File tabs, image checkboxes, download button |
| `src/components/dna/DNAPanelV2.tsx` | Modify | Wire `imageUrls` prop to ExportView |

---

### Task 1: Add `image_roles` to WebAppDNA type

**Files:**
- Modify: `src/types/dna.ts:35-93`

- [ ] **Step 1: Add ImageRole interface and field**

In `src/types/dna.ts`, add after the `PatternEvidence` interface (after line 31):

```typescript
export interface ImageRole {
  image_index: number
  role: 'usable_asset' | 'style_reference'
  description: string
}
```

Then add to the `WebAppDNA` interface, after `evidence` (line 91):

```typescript
  image_roles?: ImageRole[]
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/dna.ts
git commit -m "feat: add image_roles type to WebAppDNA"
```

---

### Task 2: Add `image_roles` to extraction prompt

**Files:**
- Modify: `src/app/api/extract-dna/prompts.ts:155-331`

- [ ] **Step 1: Add image_roles to JSON schema template**

In `buildWebAppSynthesizePrompt`, add `image_roles` to the JSON schema template after the `evidence` field (around line 276). Add a comma after the evidence array closing `]`, then add:

```
  "image_roles": [
    {
      "image_index": 0,
      "role": "usable_asset | style_reference",
      "description": "string — how to use this image or what it informed"
    }
  ]
```

- [ ] **Step 2: Add classification rules**

In the extraction rules section (around line 279-294), add after the existing rules:

```
- image_roles: One entry per image. "usable_asset" = the image IS content (photo, illustration, icon, texture) meant to appear in the final design. "style_reference" = the image shows a vibe, layout, color scheme, or pattern to draw from, not embed literally. When ambiguous, default to "style_reference". If the use case mentions using the images in the design, bias toward "usable_asset".
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extract-dna/prompts.ts
git commit -m "feat: add image_roles to extraction prompt schema"
```

---

### Task 3: Split formatters into 4 focused functions

**Files:**
- Modify: `src/lib/export-formatters.ts`

This is the largest task. The current `formatWebSkill` function (lines 21-223) must be split into 4 exported functions. Use the section mapping from the spec.

- [ ] **Step 1: Create `formatReadme` function**

Add a new exported function above `formatWebSkill`. It takes sections from the current function:

```typescript
export function formatReadme(dna: WebAppDNA, useCase?: string): string {
  const sections: string[] = []

  // Identity
  sections.push(`# Design Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  sections.push('')

  // Project instructions
  if (dna.project_instructions) {
    sections.push(`## Project Instructions`)
    const summary = dna.project_instructions.project_summary || useCase
    if (summary) {
      sections.push(`You are building: ${summary}`)
      sections.push('')
    }
    if (dna.project_instructions.sections?.length) {
      sections.push(`**Pages / Sections:**`)
      for (const section of dna.project_instructions.sections) {
        sections.push(`- ${section}`)
      }
      sections.push('')
    }
    if (dna.project_instructions.content_tone?.length) {
      sections.push(`**Content Tone:**`)
      for (const tone of dna.project_instructions.content_tone) {
        sections.push(`- ${tone}`)
      }
      sections.push('')
    }
    if (dna.project_instructions.standout_tips?.length) {
      sections.push(`**What Makes This Stand Out:**`)
      for (const tip of dna.project_instructions.standout_tips) {
        sections.push(`- ${tip}`)
      }
      sections.push('')
    }
  }

  // Positioning
  if (dna.positioning) {
    sections.push(`## Positioning`)
    sections.push(dna.positioning)
    sections.push('')
  }

  // Theme recommendation (library + rationale only, CSS vars go in style.md)
  if (dna.theme_recommendation) {
    sections.push(`## Recommended Stack`)
    sections.push(`**Library:** ${dna.theme_recommendation.library}`)
    if (dna.theme_recommendation.theme_preset) {
      sections.push(`**Preset:** ${dna.theme_recommendation.theme_preset}`)
    }
    sections.push(`**Why:** ${dna.theme_recommendation.rationale}`)
    sections.push('')
    sections.push(`**Components:** ${dna.theme_recommendation.component_notes}`)
    sections.push('')
    sections.push(`This is a recommended starting point. If you know a better-fit library for this direction, use that instead.`)
    sections.push('')
  }

  // Anti-patterns
  sections.push(`## Direction Boundaries`)
  sections.push(`These are guardrails that keep the work aligned. Favor the first quality and avoid drifting into the second:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **Favor:** ${ap.this_is}`)
    sections.push(`  **Avoid drifting into:** ${ap.not_that}`)
  }
  sections.push('')

  // Mood
  sections.push(`## Mood`)
  sections.push(dna.mood_tags.join(' | '))
  sections.push('')

  // Implementation note
  sections.push(`## Implementation`)
  sections.push(`Implement the exported values as reusable tokens, not one-off hardcoded styles. Match implementation complexity to the direction - do not default to generic component patterns that flatten the aesthetic.`)
  sections.push('')

  return sections.join('\n')
}
```

- [ ] **Step 2: Create `formatStyle` function**

```typescript
export function formatStyle(dna: WebAppDNA): string {
  const sections: string[] = []

  sections.push(`# Style Tokens: ${dna.board_name}`)
  sections.push('')

  // Color system
  sections.push(`## Color System`)
  sections.push(`**Palette relationship:** ${dna.color_palette.relationship}`)
  sections.push('')
  sections.push('```css')
  sections.push(':root {')
  for (const color of dna.color_palette.colors) {
    sections.push(`  --color-${color.role}: ${color.hex};`)
  }
  if (dna.color_palette.overlays?.length) {
    sections.push('')
    sections.push('  /* Overlay intent (downstream model decides exact values) */')
    dna.color_palette.overlays.forEach((overlay, i) => {
      sections.push(`  /* overlay-${i + 1}: ${overlay.intent} */`)
    })
  }
  sections.push('}')
  sections.push('```')
  sections.push('')
  sections.push(`Use \`--color-primary\` as the dominant. Accent should appear in < 10% of the layout but at full saturation. Never distribute colors evenly - one dominates, the rest support.`)
  if (dna.color_palette.overlays?.length) {
    sections.push(`Overlays are transparent layers for readability and tonal control - use them deliberately for scrims, color grades, or hover shifts. Do not default to blur, frosted glass, or stacked atmospheric washes unless the direction explicitly depends on them.`)
  }
  sections.push('')

  // Typography
  sections.push(`## Typography`)
  sections.push(`**Display:** ${dna.typography.display.family} (${dna.typography.display.weight}, ${dna.typography.display.classification})`)
  sections.push(`**Body:** ${dna.typography.body.family} (${dna.typography.body.weight}, ${dna.typography.body.classification})`)
  sections.push('')
  sections.push('```css')
  sections.push(':root {')
  sections.push(`  --font-display: '${dna.typography.display.family}', ${/serif/i.test(dna.typography.display.classification) ? 'serif' : dna.typography.display.classification === 'mono' ? 'monospace' : 'sans-serif'};`)
  sections.push(`  --font-body: '${dna.typography.body.family}', ${/serif/i.test(dna.typography.body.classification) ? 'serif' : dna.typography.body.classification === 'mono' ? 'monospace' : 'sans-serif'};`)
  sections.push(`  --font-weight-display: ${dna.typography.display.weight};`)
  sections.push(`  --font-weight-body: ${dna.typography.body.weight};`)
  sections.push('}')
  sections.push('```')
  sections.push('')
  sections.push(`Display font is for headlines and hero text only. Body font handles everything else. Never swap them. Never use a third font.`)
  sections.push('')

  // Spatial rules
  sections.push(`## Spatial Rules`)
  sections.push(`- **Border radius:** ${dna.border_radius}px - apply consistently to cards, buttons, inputs. 0 = brutalist, 8-12 = professional, 16+ = friendly.`)
  sections.push(`- **Density:** ${dna.spacing_density} - ${dna.spacing_density === 'compact' ? 'tight gaps (4-8px), dense information' : dna.spacing_density === 'comfortable' ? 'balanced gaps (12-16px), breathing room' : 'generous gaps (24-32px), lots of whitespace'}`)
  sections.push(`- **Shadows:** ${dna.shadow_style} - ${dna.shadow_style === 'none' ? 'no box-shadows, use borders or color contrast for depth' : dna.shadow_style === 'subtle' ? 'barely visible shadows (0 1px 3px rgba(0,0,0,0.06))' : dna.shadow_style === 'layered' ? 'stacked shadows for realistic depth (multiple shadow values)' : 'prominent shadows that lift elements off the page'}`)
  sections.push('')

  // Texture & surface
  if (dna.texture) {
    sections.push(`## Texture & Surface`)
    sections.push(`**Surface feel:** ${dna.texture.surface_feel}`)
    sections.push(`**Light & depth:** ${dna.texture.light_and_depth}`)
    sections.push(`**Texture strategy:** ${dna.texture.texture_strategy}`)
    sections.push('')
  }

  // Generated shadcn theme CSS
  if (dna.theme_recommendation && !dna.theme_recommendation.theme_preset) {
    sections.push('## Generated Theme (shadcn)')
    sections.push('```css')
    sections.push(generateShadcnTheme(dna.color_palette.colors, dna.border_radius))
    sections.push('```')
    sections.push('')
  }

  return sections.join('\n')
}
```

- [ ] **Step 3: Create `formatComposition` function**

```typescript
export function formatComposition(dna: WebAppDNA): string {
  const sections: string[] = []

  sections.push(`# Composition: ${dna.board_name}`)
  sections.push('')

  // Composition & Layout
  if (dna.composition_layout) {
    sections.push(`## Layout`)
    sections.push(`**Page archetype:** ${dna.composition_layout.page_archetype}`)
    sections.push(`**Structure:** ${dna.composition_layout.structure}`)
    sections.push(`**Spatial rules:** ${dna.composition_layout.spatial_rules}`)
    sections.push(`**Responsive:** ${dna.composition_layout.responsive_notes}`)
    sections.push('')
  }

  // Creative direction
  if (dna.creative_direction?.length) {
    sections.push(`## Creative Direction`)
    for (const cd of dna.creative_direction) {
      sections.push(`**${cd.section}**`)
      sections.push(cd.direction)
      sections.push('')
    }
  }

  // Motion & animation
  if (dna.motion) {
    sections.push(`## Motion & Animation`)
    const levelGuide: Record<string, string> = {
      'static': 'No animation. Content loads in place. Let the design speak through composition, not movement. Do not add transitions or hover effects.',
      'subtle': 'Gentle, functional motion only. Fade-ins on scroll, smooth hover states, soft transitions between states. Keep it invisible - users should feel polish, not see animation.',
      'expressive': 'Choreographed, intentional motion. Scroll-triggered sequences, staggered element reveals, page transitions. Animation tells a story and guides the eye through content.',
      'immersive': 'Animation as experience. 3D scenes, shader effects, canvas-based visuals, spatial interactions. The motion IS the design - not decoration on top of it.',
    }
    sections.push(levelGuide[dna.motion.level] || `Motion level: ${dna.motion.level}`)
    sections.push(`**Techniques:** ${dna.motion.techniques.join(', ')}`)
    sections.push(`**Recommended approach:** ${dna.motion.approach}`)
    sections.push('')
  }

  // Image direction
  if (dna.image_treatment) {
    sections.push(`## Image Direction`)
    const roleGuide: Record<string, string> = {
      'hero-driven': 'Images are the star - use full-bleed heroes, let photography drive the layout. The UI serves the imagery, not the other way around.',
      'supporting': 'Images complement the interface - visible and intentional, but the UI structure leads. Use images to reinforce, not dominate.',
      'decorative': 'Images as accent or environmental support - backgrounds, subtle patterns, secondary photography. Keep them controlled rather than turning them into generic atmospheric washes.',
      'minimal': 'Interface-first design - minimal to no imagery. Let typography, color, and whitespace carry the visual weight.',
    }
    sections.push(roleGuide[dna.image_treatment.role] || `Images are ${dna.image_treatment.role}.`)
    sections.push(`**Treatment:** ${dna.image_treatment.treatment.join(', ')}`)
    sections.push(`**Placement:** ${dna.image_treatment.placement.join(', ')}`)
    if (dna.image_treatment.text_overlay !== 'none') {
      const overlayGuide: Record<string, string> = {
        'dark-scrim': 'Use dark semi-transparent overlays (rgba(0,0,0,0.4-0.6)) to ensure text reads over images.',
        'gradient-fade': 'Use gradient transitions from image to solid color for text areas.',
        'clear-space': 'Position text in image-free zones - do not overlay text on busy image areas.',
        'knockout': 'Use knockout/reversed text directly over images - requires high-contrast imagery.',
      }
      sections.push(`**Text over images:** ${overlayGuide[dna.image_treatment.text_overlay] || dna.image_treatment.text_overlay}`)
    }
    sections.push('')
  }

  return sections.join('\n')
}
```

- [ ] **Step 4: Create `formatAssets` and shared `getImageExtension` functions**

Export `getImageExtension` so `download-package.ts` can reuse it (no duplication).

```typescript
export function getImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.png')) return 'png'
    if (pathname.endsWith('.webp')) return 'webp'
    if (pathname.endsWith('.gif')) return 'gif'
    if (pathname.endsWith('.svg')) return 'svg'
  } catch {
    // fall through
  }
  return 'jpg' // default
}

export function formatAssets(
  dna: WebAppDNA,
  imageUrls: string[],
  checkedIndices: number[]
): string {
  if (checkedIndices.length === 0) return ''

  const sections: string[] = []
  sections.push(`# Assets: ${dna.board_name}`)
  sections.push('')
  sections.push(`These images are reference assets for building this design. Use them as directed.`)
  sections.push('')

  for (const idx of checkedIndices) {
    if (idx < 0 || idx >= imageUrls.length) continue

    const assetNum = checkedIndices.indexOf(idx) + 1
    const ext = getImageExtension(imageUrls[idx])
    const filename = `asset-${assetNum}.${ext}`

    // Find the AI's description for this image, if available
    const role = dna.image_roles?.find(r => r.image_index === idx)
    const description = role?.description || 'Reference image'
    const roleLabel = role?.role === 'usable_asset' ? 'Usable asset' : 'Style reference'

    sections.push(`### ${filename}`)
    sections.push(`**Role:** ${roleLabel}`)
    sections.push(`**Usage:** ${description}`)
    sections.push(`![${description}](${filename})`)
    sections.push('')
  }

  return sections.join('\n')
}
```

- [ ] **Step 5: Update `formatForCodeTools` as backward-compat wrapper**

Note: This changes the output shape of `formatForCodeTools` for web medium. The only consumer is `ExportView`, which is being rewritten in Task 5. No other code calls this function.

Replace the existing `formatWebSkill` call inside `formatForCodeTools` to use the new functions:

```typescript
export function formatForCodeTools(
  dna: WebAppDNA | ImageGenDNA,
  medium: Medium,
  useCase?: string
): string {
  if (medium === 'web') {
    const webDna = dna as WebAppDNA
    return [
      formatReadme(webDna, useCase),
      formatStyle(webDna),
      formatComposition(webDna),
    ].join('\n---\n\n')
  }
  return formatImageGenSkill(dna as ImageGenDNA, useCase)
}
```

Delete the old `formatWebSkill` function entirely.

- [ ] **Step 6: Clean up imports**

The type import at the top of the file does not need `ImageRole` (it's accessed via `dna.image_roles` which is already typed on `WebAppDNA`). No import changes needed unless the implementer added it — if so, remove it.

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: split formatWebSkill into 4 focused export formatters"
```

---

### Task 4: Create download utility

**Files:**
- Create: `src/lib/download-package.ts`

- [ ] **Step 1: Create download-package.ts**

```typescript
// Download utility — triggers browser downloads for the multi-file export package.
// Markdown files are generated from strings, image files are fetched from canvas URLs.

import type { WebAppDNA } from '@/types/dna'
import { formatReadme, formatStyle, formatComposition, formatAssets, getImageExtension } from './export-formatters'

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadImage(filename: string, imageUrl: string) {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Download the full export package: 3-4 markdown files + image files.
 * Downloads are staggered by 100ms to avoid browser popup blockers.
 */
export async function downloadPackage(opts: {
  dna: WebAppDNA
  useCase?: string
  imageUrls: string[]
  checkedIndices: number[]
}) {
  const { dna, useCase, imageUrls, checkedIndices } = opts

  // Markdown files
  downloadMarkdown('README.md', formatReadme(dna, useCase))
  await delay(100)

  downloadMarkdown('style.md', formatStyle(dna))
  await delay(100)

  downloadMarkdown('composition.md', formatComposition(dna))
  await delay(100)

  // Assets (only if images are checked)
  if (checkedIndices.length > 0) {
    const assetsContent = formatAssets(dna, imageUrls, checkedIndices)
    if (assetsContent) {
      downloadMarkdown('assets.md', assetsContent)
      await delay(100)
    }

    // Download actual image files
    for (const idx of checkedIndices) {
      if (idx < 0 || idx >= imageUrls.length) continue
      const assetNum = checkedIndices.indexOf(idx) + 1
      const ext = getImageExtension(imageUrls[idx])
      await downloadImage(`asset-${assetNum}.${ext}`, imageUrls[idx])
      await delay(100)
    }
  }
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/download-package.ts
git commit -m "feat: add download-package utility for multi-file export"
```

---

### Task 5: Redesign ExportView with file tabs

**Files:**
- Rewrite: `src/components/dna/ExportView.tsx`
- Modify: `src/components/dna/DNAPanelV2.tsx:383-394`

This task rewrites ExportView for web medium (file tabs + image checkboxes + download button) while keeping image medium unchanged (current Midjourney UI).

- [ ] **Step 1: Add `imageUrls` prop to ExportView and wire in DNAPanelV2**

In `src/components/dna/DNAPanelV2.tsx`, find the ExportView render (around line 386-391) and add the `imageUrls` prop:

```typescript
<ExportView
  medium={medium}
  dna={dna}
  useCase={useCase}
  boardId={boardId}
  imageUrls={imageUrls}
/>
```

In `src/components/dna/ExportView.tsx`, update the props interface:

```typescript
interface ExportViewProps {
  medium: Medium
  dna: WebAppDNA | ImageGenDNA
  useCase: string
  boardId: string | null
  imageUrls: string[]
}
```

- [ ] **Step 2: Rewrite ExportView for web medium**

Replace the entire ExportView component body. The new version:
- For `medium === 'image'`: renders the existing Midjourney UI (format toggle, single pre block, copy)
- For `medium === 'web'`: renders file tabs (README | Style | Composition | Assets), preview, image checkboxes, download button

```typescript
'use client'

import { useState, useMemo } from 'react'
import { Copy, Check, FileText, Sparkles, Download, Image as ImageIcon } from 'lucide-react'
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
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Manual test in browser**

1. Open a board with images, extract DNA
2. Switch to Export tab
3. Verify: 4 file tabs appear (README, Style, Composition, Assets)
4. Verify: clicking each tab shows different content
5. Verify: image thumbnails with checkboxes appear below preview
6. Verify: unchecking all images greys out Assets tab
7. Verify: Copy button works per file
8. Verify: Download Package triggers multiple file downloads
9. Verify: downloaded files have correct content
10. Verify: image files download alongside markdown

- [ ] **Step 5: Test image medium unchanged**

1. Extract DNA on an image-medium board
2. Verify: old Skill.md / Midjourney toggle still appears
3. Verify: copy works as before

- [ ] **Step 6: Commit**

```bash
git add src/components/dna/ExportView.tsx src/components/dna/DNAPanelV2.tsx
git commit -m "feat: redesign export tab with file tabs, image checkboxes, and download"
```

---

## Task Dependency Order

```
Task 1 (types) → Task 2 (prompt) — independent from Task 3-5
Task 1 (types) → Task 3 (formatters) → Task 4 (download) → Task 5 (UI)
```

Task 1 must complete first since all others depend on the `ImageRole` type. After that, Task 2 (prompt) is independent from Tasks 3-5 (formatters + UI) and can be done in parallel.
