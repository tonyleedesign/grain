// Export formatters - generate skill.md files that instruct LLMs on design behavior.
// Based on research: Anthropic's frontend-design skill structure, typeui.sh patterns,
// and anti-slop techniques. The export is a behavioral contract, not just tokens.

import type { WebAppDNA, ImageGenDNA, Medium, DesignMD } from '@/types/dna'
import { generateShadcnTheme } from './theme-generator'

// --- Formatters ---

export interface ExportImage {
  url: string
  index: number
  sourceIndex?: number
}

function quoteYaml(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function firstSentence(value?: string) {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  const match = normalized.match(/^.*?[.!?](?:\s|$)/)
  return (match ? match[0] : normalized).trim()
}

function formatExpandedDesignBrief(dna: DesignMD, useCase?: string) {
  const seed = useCase?.trim()
  const thesis = firstSentence(dna.overview)
  const direction = firstSentence(dna.creativeDirection)
  const buildTarget = seed || 'a focused digital experience'

  const lines: string[] = []
  if (seed) {
    lines.push(`User seed: ${seed}`)
    lines.push('')
  }

  lines.push(`Build ${buildTarget} as a complete, usable product shaped by the "${dna.name}" design system.`)
  if (thesis) lines.push(thesis)
  if (direction && direction !== thesis) lines.push(direction)
  lines.push('')
  lines.push('Use the user seed as intent, not as final copy. Expand sparse or informal input into a concrete product structure, content model, and interaction flow that fit the reference-derived visual direction.')

  return lines.join('\n')
}

function hasUsefulComponents(dna: DesignMD) {
  const components = dna.tokens.components
  if (!components) return false

  return Object.values(components).some((component) =>
    Object.values(component).some((value) => typeof value === 'string' && value.trim().length > 0)
  )
}

function formatDesignDirection(dna: DesignMD) {
  const parts = [
    firstSentence(dna.overview),
    firstSentence(dna.creativeDirection),
  ].filter(Boolean)

  if (parts.length === 0) return ''

  return parts.join(' ')
}

export function formatDesignMd(dna: DesignMD, _images?: ExportImage[]): string {
  void _images
  const lines: string[] = []
  const includeComponents = hasUsefulComponents(dna)

  lines.push('---')
  lines.push('schema: grain-design-md')
  lines.push('schemaVersion: 1')
  lines.push(`name: ${quoteYaml(dna.name || 'Grain Design System')}`)

  lines.push('colors:')
  for (const [name, hex] of Object.entries(dna.tokens.colors)) {
    lines.push(`  ${name}: ${quoteYaml(hex)}`)
  }

  lines.push('typography:')
  for (const [level, token] of Object.entries(dna.tokens.typography)) {
    if (!token) continue
    lines.push(`  ${level}:`)
    lines.push(`    fontFamily: ${quoteYaml(token.fontFamily)}`)
    lines.push(`    fontSize: ${quoteYaml(token.fontSize)}`)
    lines.push(`    fontWeight: ${token.fontWeight}`)
    if (token.lineHeight) lines.push(`    lineHeight: ${quoteYaml(token.lineHeight)}`)
    if (token.letterSpacing) lines.push(`    letterSpacing: ${quoteYaml(token.letterSpacing)}`)
  }

  lines.push('rounded:')
  for (const [scale, value] of Object.entries(dna.tokens.rounded)) {
    if (value) lines.push(`  ${scale}: ${quoteYaml(value)}`)
  }

  lines.push('spacing:')
  for (const [scale, value] of Object.entries(dna.tokens.spacing)) {
    if (value) lines.push(`  ${scale}: ${quoteYaml(value)}`)
  }

  if (includeComponents && dna.tokens.components) {
    lines.push('components:')
    for (const [name, token] of Object.entries(dna.tokens.components)) {
      const entries = Object.entries(token).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0
      )
      if (entries.length === 0) continue
      lines.push(`  ${name}:`)
      for (const [prop, value] of entries) {
        lines.push(`    ${prop}: ${quoteYaml(value)}`)
      }
    }
  }

  lines.push('---')
  lines.push('')

  lines.push('## Overview')
  lines.push('')
  lines.push(dna.overview)
  lines.push('')

  lines.push('## Colors')
  lines.push('')
  lines.push(dna.colors)
  lines.push('')

  lines.push('## Typography')
  lines.push('')
  lines.push(dna.typography)
  lines.push('')

  lines.push('## Layout & Spacing')
  lines.push('')
  lines.push(dna.layoutSpacing)
  lines.push('')

  lines.push('## Elevation & Depth')
  lines.push('')
  lines.push(dna.elevationDepth)
  lines.push('')

  lines.push('## Shapes')
  lines.push('')
  lines.push(dna.shapes)
  lines.push('')

  if (includeComponents && dna.components.trim()) {
    lines.push('## Components')
    lines.push('')
    lines.push(dna.components)
    lines.push('')
  }

  lines.push("## Do's and Don'ts")
  lines.push('')
  lines.push(dna.dosAndDonts)
  lines.push('')

  lines.push('## Creative Direction')
  lines.push('')
  lines.push(dna.creativeDirection)
  lines.push('')

  lines.push('## Motion')
  lines.push('')
  lines.push(dna.motion)
  lines.push('')

  return lines.join('\n')
}

export function formatDesignPackageReadme(
  dna: DesignMD,
  useCase?: string,
  images?: ExportImage[]
): string {
  const lines: string[] = []

  lines.push(`# ${dna.name}`)
  lines.push('')

  lines.push('## Project Brief')
  lines.push('')
  lines.push(formatExpandedDesignBrief(dna, useCase))
  lines.push('')

  const designDirection = formatDesignDirection(dna)
  if (designDirection) {
    lines.push('## Design Direction')
    lines.push('')
    lines.push(designDirection)
    lines.push('')
  }

  lines.push("## Do's and Don'ts")
  lines.push('')
  lines.push(dna.dosAndDonts)
  lines.push('')

  lines.push('## Files')
  lines.push('')
  lines.push('| File | Description |')
  lines.push('|------|-------------|')
  lines.push('| `README.md` | Project brief, direction rules, and file guide |')
  lines.push('| `DESIGN.md` | Complete design system -- YAML tokens + prose rationale |')
  lines.push('| `ASSETS.md` | Reference image usage instructions |')
  lines.push('| `design_tokens.json` | DTCG-format tokens for Figma, Style Dictionary, and token pipelines |')

  if (images && images.length > 0) {
    for (const image of images) {
      const ext = getImageExtension(image.url)
      lines.push(`| \`asset-${image.index + 1}.${ext}\` | Reference image ${image.index + 1} |`)
    }
  }

  lines.push('')
  lines.push('## Priority')
  lines.push('')
  lines.push('`README.md` defines product intent. `DESIGN.md` defines the visual system. `ASSETS.md` defines how to use reference images. `design_tokens.json` is a machine-readable version of the same tokens -- use it with Figma, Style Dictionary, or any token pipeline.')
  lines.push('')

  return lines.join('\n')
}

export function formatDesignAssets(
  dna: DesignMD,
  images: ExportImage[]
): string {
  const lines: string[] = []

  lines.push(`# Assets: ${dna.name}`)
  lines.push('')

  if (images.length === 0) {
    lines.push('No reference assets selected.')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('> **Priority: EXACT** -- These are required reference assets. Incorporate them into the build as specified. Do not generate placeholder images when these references are provided.')
  lines.push('')
  lines.push('You MUST incorporate these references into the final build. Let them influence the overall design language, image treatment, and visual direction.')
  lines.push('')

  for (const image of images) {
    const ext = getImageExtension(image.url)
    const filename = `asset-${image.index + 1}.${ext}`
    const evidence = dna.evidence?.find((item) => item.image_index === (image.sourceIndex ?? image.index))
      ?? dna.evidence?.find((item) => item.image_index === image.index)
    const quality = evidence?.quality?.trim()
    const regionHint = evidence?.region_hint?.trim()
    const conflict = evidence?.conflict?.trim()

    lines.push(`### ${filename}`)
    lines.push('**Role:** Style reference')
    lines.push(`**Scope:** Global -- ${quality ? `anchors ${quality}` : 'influences overall visual direction'}`)
    if (quality || regionHint) {
      const focus = [quality, regionHint ? `visible around ${regionHint}` : ''].filter(Boolean).join(', ')
      lines.push(`**Usage:** Preserve the ${focus}. Let this reference guide composition, crop behavior, image treatment, material feel, and visual restraint. Do not embed it literally unless it is a usable asset that fits the final design.`)
    } else {
      lines.push('**Usage:** Use this reference to preserve composition, image treatment, material feel, and visual direction. Do not embed it literally unless it is a usable asset that fits the final design.')
    }
    if (conflict) {
      lines.push(`**Tension:** ${conflict}`)
    }
    lines.push(`![Reference ${image.index + 1}](${filename})`)
    lines.push('')
  }

  return lines.join('\n')
}

export function formatDesignTokensJson(dna: DesignMD): string {
  const tokens: Record<string, unknown> = {}

  const colors: Record<string, unknown> = {}
  for (const [name, hex] of Object.entries(dna.tokens.colors)) {
    colors[name] = { $type: 'color', $value: hex }
  }
  if (Object.keys(colors).length > 0) tokens.colors = colors

  const typography: Record<string, unknown> = {}
  for (const [level, token] of Object.entries(dna.tokens.typography)) {
    if (!token) continue
    typography[level] = {
      $type: 'typography',
      $value: {
        fontFamily: token.fontFamily,
        fontSize: token.fontSize,
        fontWeight: token.fontWeight,
        ...(token.lineHeight ? { lineHeight: token.lineHeight } : {}),
        ...(token.letterSpacing ? { letterSpacing: token.letterSpacing } : {}),
      },
    }
  }
  if (Object.keys(typography).length > 0) tokens.typography = typography

  const rounded: Record<string, unknown> = {}
  for (const [scale, value] of Object.entries(dna.tokens.rounded)) {
    if (value) rounded[scale] = { $type: 'dimension', $value: value }
  }
  tokens.rounded = rounded

  const spacing: Record<string, unknown> = {}
  for (const [scale, value] of Object.entries(dna.tokens.spacing)) {
    if (value) spacing[scale] = { $type: 'dimension', $value: value }
  }
  tokens.spacing = spacing

  if (dna.tokens.components && Object.keys(dna.tokens.components).length > 0) {
    const components: Record<string, unknown> = {}
    for (const [name, component] of Object.entries(dna.tokens.components)) {
      const props: Record<string, unknown> = {}
      for (const [prop, value] of Object.entries(component)) {
        if (value) props[prop] = { $type: 'string', $value: value }
      }
      components[name] = props
    }
    tokens.components = components
  }

  return JSON.stringify(tokens, null, 2)
}

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

export function formatReadme(dna: WebAppDNA, useCase?: string): string {
  const sections: string[] = []

  sections.push(`# Design Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  sections.push('')
  sections.push(`> **Priority: EXACT** — This file defines the project contract. style.md, composition.md, and assets.md support it. If files conflict, this one wins.`)
  sections.push('')

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

  // Decision Sheet — hard answers to reduce builder inference
  sections.push(`## Decision Sheet`)
  if (dna.theme_recommendation) {
    sections.push(`- **Stack:** Required. Use ${dna.theme_recommendation.library}${dna.theme_recommendation.theme_preset ? ` with ${dna.theme_recommendation.theme_preset} preset` : ''}. Do not substitute without justifying first.`)
  }
  const projectSummary = dna.project_instructions?.project_summary || useCase
  if (projectSummary) {
    sections.push(`- **Content:** Use real data where the subject is identifiable. If the subject is unfamiliar, research it before building. Use real facts, real imagery, and real content where possible — placeholder copy will weaken the result.`)
  } else {
    sections.push(`- **Content:** Styled placeholder content is acceptable for this project.`)
  }
  sections.push(`- **Images:** Reference images are provided in assets.md. Images marked as \`usable_asset\` may appear directly in the final build. Images marked as \`style_reference\` inform the design direction only — do not embed them literally. For images beyond the provided assets, source from open-source image libraries (Unsplash, Pexels, etc.). Use real photography that matches the project's visual direction — do not use AI-generated placeholder images.`)
  sections.push('')

  // Non-Negotiables — derived from strongest DNA signals, stated as hard rules
  const nonNegotiables: string[] = []
  if (dna.theme_recommendation) {
    nonNegotiables.push(`Must use ${dna.theme_recommendation.library}${dna.theme_recommendation.theme_preset ? ` ${dna.theme_recommendation.theme_preset}` : ''}`)
  }
  if (dna.image_treatment?.treatment?.length) {
    nonNegotiables.push(`Must keep ${dna.image_treatment.treatment.join(', ')} image treatment`)
  }
  for (const ap of dna.anti_patterns.slice(0, 3)) {
    nonNegotiables.push(`Must not drift into: ${ap.not_that}`)
  }
  if (nonNegotiables.length > 0) {
    sections.push(`## Non-Negotiables`)
    for (const rule of nonNegotiables) {
      sections.push(`- ${rule}`)
    }
    sections.push('')
  }

  if (dna.positioning) {
    sections.push(`## Positioning`)
    sections.push(dna.positioning)
    sections.push('')
  }

  if (dna.theme_recommendation) {
    sections.push(`## Required Stack`)
    sections.push(`**Library:** ${dna.theme_recommendation.library}`)
    if (dna.theme_recommendation.theme_preset) {
      sections.push(`**Preset:** ${dna.theme_recommendation.theme_preset}`)
    }
    sections.push(`**Why:** ${dna.theme_recommendation.rationale}`)
    sections.push('')
    sections.push(`**Components:** ${dna.theme_recommendation.component_notes}`)
    sections.push('')
    sections.push(`Use this stack. If you have a strong reason to deviate, justify the alternative before building — do not silently substitute.`)
    sections.push('')
  }

  sections.push(`## Direction Boundaries`)
  sections.push(`These are guardrails that keep the work aligned. Favor the first quality and avoid drifting into the second:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **Favor:** ${ap.this_is}`)
    sections.push(`  **Avoid drifting into:** ${ap.not_that}`)
  }
  sections.push('')

  sections.push(`## Mood`)
  sections.push(dna.mood_tags.join(' | '))
  sections.push('')

  sections.push(`## Implementation`)
  sections.push(`Implement the exported values as reusable tokens, not one-off hardcoded styles. Match implementation complexity to the direction - do not default to generic component patterns that flatten the aesthetic.`)
  sections.push('')

  return sections.join('\n')
}

function buildGoogleFontsUrl(dna: WebAppDNA): string {
  const displayFamily = dna.typography.display.family.replace(/ /g, '+')
  const bodyFamily = dna.typography.body.family.replace(/ /g, '+')
  const displayWeight = dna.typography.display.weight
  const bodyWeight = dna.typography.body.weight
  if (displayFamily === bodyFamily) {
    return `https://fonts.googleapis.com/css2?family=${displayFamily}:wght@${displayWeight};${bodyWeight}&display=swap`
  }
  return `https://fonts.googleapis.com/css2?family=${displayFamily}:wght@${displayWeight}&family=${bodyFamily}:wght@${bodyWeight}&display=swap`
}

export function formatStyle(dna: WebAppDNA): string {
  const sections: string[] = []

  sections.push(`# Style Tokens: ${dna.board_name}`)
  sections.push('')
  sections.push(`> **Priority: EXACT** — These are implementation tokens. Apply them exactly as specified. Do not approximate or substitute.`)
  sections.push('')

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
  sections.push(`Load both fonts from Google Fonts:`)
  sections.push('```')
  sections.push(`@import url('${buildGoogleFontsUrl(dna)}');`)
  sections.push('```')
  sections.push('')
  sections.push(`If the display font fails to load, the fallback must preserve the classification — substitute another ${dna.typography.display.classification}, not a generic sans-serif.`)
  sections.push('')

  sections.push(`## Spatial Rules`)
  sections.push(`- **Border radius:** ${dna.border_radius}px - apply consistently to cards, buttons, inputs. 0 = brutalist, 8-12 = professional, 16+ = friendly.`)
  sections.push(`- **Density:** ${dna.spacing_density} - ${dna.spacing_density === 'compact' ? 'tight gaps (4-8px), dense information' : dna.spacing_density === 'comfortable' ? 'balanced gaps (12-16px), breathing room' : 'generous gaps (24-32px), lots of whitespace'}`)
  sections.push(`- **Shadows:** ${dna.shadow_style} - ${dna.shadow_style === 'none' ? 'no box-shadows, use borders or color contrast for depth' : dna.shadow_style === 'subtle' ? 'barely visible shadows (0 1px 3px rgba(0,0,0,0.06))' : dna.shadow_style === 'layered' ? 'stacked shadows for realistic depth (multiple shadow values)' : 'prominent shadows that lift elements off the page'}`)
  sections.push('')

  if (dna.texture) {
    sections.push(`## Texture & Surface`)
    sections.push(`**Surface feel:** ${dna.texture.surface_feel}`)
    sections.push(`**Light & depth:** ${dna.texture.light_and_depth}`)
    sections.push(`**Texture strategy:** ${dna.texture.texture_strategy}`)
    sections.push('')
  }

  if (dna.theme_recommendation && !dna.theme_recommendation.theme_preset) {
    sections.push('## Generated Theme (shadcn)')
    sections.push('```css')
    sections.push(generateShadcnTheme(dna.color_palette.colors, dna.border_radius))
    sections.push('```')
    sections.push('')
  }

  return sections.join('\n')
}

export function formatComposition(dna: WebAppDNA): string {
  const sections: string[] = []

  sections.push(`# Composition: ${dna.board_name}`)
  sections.push('')
  sections.push(`> **Priority: DIRECTIONAL** — This is creative direction. Use your judgment within these boundaries. Layout decisions, section transitions, and motion choreography are yours to determine — but stay within the described feel.`)
  sections.push('')

  if (dna.composition_layout) {
    sections.push(`## Layout`)
    sections.push(`**Page archetype:** ${dna.composition_layout.page_archetype}`)
    sections.push(`**Structure:** ${dna.composition_layout.structure}`)
    sections.push(`**Spatial rules:** ${dna.composition_layout.spatial_rules}`)
    sections.push(`**Responsive:** ${dna.composition_layout.responsive_notes}`)
    sections.push('')
    sections.push(`Sections may be full-width, boxed, overlapping, or nested — choose what fits the archetype above. Maintain visual consistency in navigation and typography across sections, but allow deliberate variation in background treatment, density, and composition between sections.`)
    sections.push('')
  }

  if (dna.creative_direction?.length) {
    sections.push(`## Creative Direction`)
    for (const cd of dna.creative_direction) {
      sections.push(`**${cd.section}**`)
      sections.push(cd.direction)
      sections.push('')
    }
  }

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
  sections.push(`> **Priority: EXACT** — These are required reference assets. Incorporate them into the build as specified. Do not generate placeholder images when these references are provided.`)
  sections.push('')
  sections.push(`You MUST incorporate these references into the final build. For global-scope images, let them influence the overall site framing and design language. For section-scope images, apply them to the specific sections noted in their usage description.`)
  sections.push('')

  const globalKeywords = ['hero', 'overall', 'site-wide', 'framing', 'global', 'whole', 'entire', 'general']

  for (let pos = 0; pos < checkedIndices.length; pos++) {
    const idx = checkedIndices[pos]
    if (idx < 0 || idx >= imageUrls.length) continue

    const ext = getImageExtension(imageUrls[idx])
    const filename = `asset-${pos + 1}.${ext}`

    const role = dna.image_roles?.find(r => r.image_index === idx)
    const description = role?.description || 'Reference image'
    const roleLabel = role?.role === 'usable_asset' ? 'Usable asset' : 'Style reference'
    const descLower = description.toLowerCase()
    const isGlobal = globalKeywords.some(kw => descLower.includes(kw))
    const scopeLabel = isGlobal ? 'Global — influences overall site framing' : 'Section — applies to specific sections noted in usage'

    sections.push(`### ${filename}`)
    sections.push(`**Role:** ${roleLabel}`)
    sections.push(`**Scope:** ${scopeLabel}`)
    sections.push(`**Usage:** ${description}`)
    sections.push(`![${description}](${filename})`)
    sections.push('')
  }

  return sections.join('\n')
}

function formatImageGenSkill(dna: ImageGenDNA, useCase?: string): string {
  const sections: string[] = []

  // Identity
  sections.push(`# Visual Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  sections.push('')

  if (useCase) {
    sections.push(`## Intended Use`)
    sections.push(useCase)
    sections.push('')
  }

  // Core parameters
  sections.push(`## Visual Identity`)
  sections.push(`**Medium:** ${dna.medium_type.primary} - ${dna.medium_type.sub_tags.join(', ')}`)
  sections.push(`**Mood:** ${dna.mood_tags.join(' | ')}`)
  sections.push(`**Palette:** ${dna.color_palette.mood} - ${dna.color_palette.colors.join(', ')}`)
  sections.push('')

  // Lighting - professional vocabulary
  sections.push(`## Lighting`)
  for (const light of dna.lighting) {
    sections.push(`- ${light}`)
  }
  sections.push('')

  // Texture
  sections.push(`## Texture & Surface`)
  sections.push(`**Level:** ${dna.texture.level}`)
  sections.push(`**Keywords:** ${dna.texture.keywords.join(', ')}`)
  sections.push('')

  // Composition
  sections.push(`## Composition`)
  sections.push(`**Style:** ${dna.composition.style}`)
  sections.push(`${dna.composition.description}`)
  sections.push('')

  // Era / Movement
  sections.push(`## Era & Movement`)
  sections.push(dna.era_movement.map(e => `- ${e}`).join('\n'))
  sections.push('')

  // Anti-patterns from DNA (personalized)
  sections.push(`## Direction Boundaries`)
  sections.push(`These are guardrails for staying in-bounds. Favor the first quality and avoid drifting into the second:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **Favor:** ${ap.this_is}`)
    sections.push(`  **Avoid drifting into:** ${ap.not_that}`)
  }
  sections.push('')

  sections.push(`## Implementation`)
  sections.push(`Lead prompts with medium, composition, lighting, and texture before subject detail. Use anti-patterns as negative guidance, not just descriptive contrast.`)
  sections.push('')

  return sections.join('\n')
}

export function formatForMidjourney(dna: ImageGenDNA, useCase?: string): string {
  const parts: string[] = []

  if (useCase) parts.push(useCase)

  // Medium and technique
  parts.push(dna.medium_type.primary)
  parts.push(...dna.medium_type.sub_tags)

  // Lighting
  parts.push(...dna.lighting)

  // Texture
  if (dna.texture.level !== 'clean') {
    parts.push(...dna.texture.keywords)
  }

  // Composition
  parts.push(dna.composition.style)

  // Era
  parts.push(...dna.era_movement)

  // Mood
  parts.push(...dna.mood_tags)

  // Color mood
  parts.push(dna.color_palette.mood)

  // Anti-patterns as --no flags
  const noFlags = dna.anti_patterns.map((ap) => ap.not_that).join(', ')

  let prompt = parts.join(', ')
  if (noFlags) {
    prompt += ` --no ${noFlags}`
  }

  return prompt
}
