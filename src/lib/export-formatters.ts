// Export formatters — generate skill.md files that instruct LLMs on design behavior.
// Based on research: Anthropic's frontend-design skill structure, typeui.sh patterns,
// and anti-slop techniques. The export is a behavioral contract, not just tokens.

import type { WebAppDNA, ImageGenDNA, Medium } from '@/types/dna'

// ─── Hardcoded best practices (Level 3: Creative Direction) ───
// These prevent distributional convergence regardless of extracted DNA.
// Sourced from Anthropic's frontend-design SKILL.md + research synthesis.

const WEB_ANTI_SLOP = `## What NOT to Do
- NEVER use Inter, Roboto, Open Sans, or system-default fonts — these signal "AI-generated"
- NEVER use purple-to-blue gradients on white backgrounds
- NEVER use three equal-width cards in a row — break the pattern
- NEVER use light gray (#f5f5f5) backgrounds with thin gray borders — this is the default AI look
- NEVER center everything — use asymmetry, offset grids, diagonal flow`

const WEB_IMPLEMENTATION = `## Implementation Rules
- Use CSS custom properties for all values — no hardcoded colors or sizes in components
- Typography: pair a distinctive display face with a readable body face — never use the same font for both
- Grid-breaking: let one element overlap, bleed, or break the grid per section
- Match complexity to vision — a brutalist site needs different code patterns than a luxury one`

const IMAGE_GEN_ANTI_SLOP = `## What NOT to Do
- NEVER use camera settings like "f/1.4" or "ISO 400" — use descriptive terms instead
- NEVER list contradictory styles (e.g. "minimalist maximalist")
- NEVER use "cinematic" without specifying what kind — it's meaningless alone
- NEVER use "8k, ultra-detailed, masterpiece" — these are noise words that dilute actual direction
- NEVER combine incompatible lighting (e.g. "soft light, harsh shadows")
- NEVER use "trending on ArtStation" or platform-specific quality markers`

const IMAGE_GEN_IMPLEMENTATION = `## Prompt Construction Rules
- Lead with medium and technique, not subject matter
- Lighting terms should be specific and from professional photography vocabulary
- Color should be described as mood + palette, not individual hex values
- Composition archetypes (rule of thirds, centered, diagonal) go before subject description
- Texture and grain levels are stronger style signals than color
- Anti-patterns translate to --no flags in Midjourney, negative prompts in Stable Diffusion
- Era/movement references anchor the entire aesthetic — place them prominently`

// ─── Formatters ───

export function formatForCodeTools(
  dna: WebAppDNA | ImageGenDNA,
  medium: Medium,
  useCase?: string
): string {
  if (medium === 'web') {
    return formatWebSkill(dna as WebAppDNA, useCase)
  }
  return formatImageGenSkill(dna as ImageGenDNA, useCase)
}

function formatWebSkill(dna: WebAppDNA, useCase?: string): string {
  const sections: string[] = []

  // Identity
  sections.push(`# Design Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  if (useCase) {
    sections.push(`>`)
    sections.push(`> Building: ${useCase}`)
  }
  sections.push('')

  // Design thinking — attitude, not just tokens
  sections.push(`## Design Thinking`)
  sections.push(`**Mood:** ${dna.mood_tags.join(' · ')}`)
  sections.push(`**Palette relationship:** ${dna.color_palette.relationship}`)
  sections.push(`**Spatial feel:** ${dna.spacing_density} density, ${dna.shadow_style} shadows, ${dna.border_radius}px radius`)
  sections.push('')
  sections.push(`Ask yourself before every component: does this reinforce "${dna.direction_summary}" or dilute it?`)
  sections.push('')

  // Anti-patterns from DNA (personalized)
  sections.push(`## Design Boundaries`)
  sections.push(`These are non-negotiable. Every design decision must pass through these filters:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **DO:** ${ap.this_is}`)
    sections.push(`  **NEVER:** ${ap.not_that}`)
  }
  sections.push('')

  // Color system — literal values
  sections.push(`## Color System`)
  sections.push('```css')
  sections.push(':root {')
  for (const color of dna.color_palette.colors) {
    sections.push(`  --color-${color.role}: ${color.hex};`)
  }
  if (dna.color_palette.overlays?.length) {
    sections.push('')
    sections.push('  /* Overlays & transparent layers */')
    for (const overlay of dna.color_palette.overlays) {
      const varName = overlay.use.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
      sections.push(`  --overlay-${varName}: ${overlay.rgba};`)
    }
  }
  sections.push('}')
  sections.push('```')
  sections.push('')
  sections.push(`Use \`--color-primary\` as the dominant. Accent should appear in < 10% of the layout but at full saturation. Never distribute colors evenly — one dominates, the rest support.`)
  if (dna.color_palette.overlays?.length) {
    sections.push(`Overlays are transparent layers — use them for scrims, color grades, tinted glass, hover states, and atmospheric effects. Apply with background-color or as pseudo-element overlays, never as solid fills.`)
  }
  sections.push('')

  // Typography — with implementation guidance
  sections.push(`## Typography`)
  sections.push(`**Display:** ${dna.typography.display.family} (${dna.typography.display.weight}, ${dna.typography.display.classification})`)
  sections.push(`**Body:** ${dna.typography.body.family} (${dna.typography.body.weight}, ${dna.typography.body.classification})`)
  sections.push('')
  sections.push('```css')
  sections.push(':root {')
  sections.push(`  --font-display: '${dna.typography.display.family}', ${dna.typography.display.classification === 'serif' ? 'serif' : 'sans-serif'};`)
  sections.push(`  --font-body: '${dna.typography.body.family}', ${dna.typography.body.classification === 'serif' ? 'serif' : 'sans-serif'};`)
  sections.push(`  --font-weight-display: ${dna.typography.display.weight};`)
  sections.push(`  --font-weight-body: ${dna.typography.body.weight};`)
  sections.push('}')
  sections.push('```')
  sections.push('')
  sections.push(`Display font is for headlines and hero text only. Body font handles everything else. Never swap them. Never use a third font.`)
  sections.push('')

  // Spatial rules
  sections.push(`## Spatial Rules`)
  sections.push(`- **Border radius:** ${dna.border_radius}px — apply consistently to cards, buttons, inputs. 0 = brutalist, 8-12 = professional, 16+ = friendly.`)
  sections.push(`- **Density:** ${dna.spacing_density} — ${dna.spacing_density === 'compact' ? 'tight gaps (4-8px), dense information' : dna.spacing_density === 'comfortable' ? 'balanced gaps (12-16px), breathing room' : 'generous gaps (24-32px), lots of whitespace'}`)
  sections.push(`- **Shadows:** ${dna.shadow_style} — ${dna.shadow_style === 'none' ? 'no box-shadows, use borders or color contrast for depth' : dna.shadow_style === 'subtle' ? 'barely visible shadows (0 1px 3px rgba(0,0,0,0.06))' : dna.shadow_style === 'layered' ? 'stacked shadows for realistic depth (multiple shadow values)' : 'prominent shadows that lift elements off the page'}`)
  sections.push('')

  // Texture & surface
  if (dna.texture) {
    sections.push(`## Texture & Surface`)
    const finishGuide: Record<string, string> = {
      'matte': 'Flat, non-reflective surfaces. No glossy effects, no glass-morphism. Think paper, concrete, chalk.',
      'glossy': 'Reflective, polished surfaces. Glass-morphism, sheen effects, and high-contrast highlights are appropriate.',
      'frosted': 'Semi-transparent, blurred surfaces. Use backdrop-blur, frosted glass cards, and translucent overlays.',
      'raw': 'Unpolished, textured surfaces. Embrace imperfection — visible grain, rough edges, analog feel.',
    }
    sections.push(finishGuide[dna.texture.finish] || `Finish: ${dna.texture.finish}`)
    if (dna.texture.light_behavior) {
      const lightGuide: Record<string, string> = {
        'absorptive': 'Surfaces absorb light — no specular highlights, no gloss effects, no glass-morphism. Light dies on contact.',
        'reflective': 'Surfaces reflect light — specular highlights, glossy effects, and glass-morphism are appropriate. Light bounces and shines.',
        'mixed': 'Both matte and reflective surfaces coexist — use contrast between absorptive backgrounds and reflective interactive elements.',
      }
      sections.push(`**Light behavior:** ${lightGuide[dna.texture.light_behavior] || dna.texture.light_behavior}`)
    }
    if (dna.texture.shadow_crush) {
      const shadowGuide: Record<string, string> = {
        'none': 'Preserve full shadow detail — no crushed blacks, keep tonal range open.',
        'moderate': 'Allow some shadow compression — darks can lose detail but midtones stay readable.',
        'heavy': 'Embrace deep, crushed blacks — shadows swallow detail, creating dramatic contrast and mystery.',
      }
      sections.push(`**Shadows:** ${shadowGuide[dna.texture.shadow_crush] || dna.texture.shadow_crush}`)
    }
    sections.push(`**Background treatments:** ${dna.texture.background.join(', ')}`)
    sections.push('')
    sections.push(`Apply these textures to page backgrounds, card surfaces, and section dividers. Texture should be felt, not seen — if it distracts from content, dial it back.`)
    sections.push('')
  }

  // Motion & animation
  if (dna.motion) {
    sections.push(`## Motion & Animation`)
    const levelGuide: Record<string, string> = {
      'static': 'No animation. Content loads in place. Let the design speak through composition, not movement. Do not add transitions or hover effects.',
      'subtle': 'Gentle, functional motion only. Fade-ins on scroll, smooth hover states, soft transitions between states. Keep it invisible — users should feel polish, not see animation.',
      'expressive': 'Choreographed, intentional motion. Scroll-triggered sequences, staggered element reveals, page transitions. Animation tells a story and guides the eye through content.',
      'immersive': 'Animation as experience. 3D scenes, shader effects, canvas-based visuals, spatial interactions. The motion IS the design — not decoration on top of it.',
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
      'hero-driven': 'Images are the star — use full-bleed heroes, let photography drive the layout. The UI serves the imagery, not the other way around.',
      'supporting': 'Images complement the interface — visible and intentional, but the UI structure leads. Use images to reinforce, not dominate.',
      'decorative': 'Images as texture and atmosphere — backgrounds, subtle patterns, accent photography. Keep imagery ambient, not focal.',
      'minimal': 'Interface-first design — minimal to no imagery. Let typography, color, and whitespace carry the visual weight.',
    }
    sections.push(roleGuide[dna.image_treatment.role] || `Images are ${dna.image_treatment.role}.`)
    sections.push(`**Treatment:** ${dna.image_treatment.treatment.join(', ')}`)
    sections.push(`**Placement:** ${dna.image_treatment.placement.join(', ')}`)
    if (dna.image_treatment.text_overlay !== 'none') {
      const overlayGuide: Record<string, string> = {
        'dark-scrim': 'Use dark semi-transparent overlays (rgba(0,0,0,0.4-0.6)) to ensure text reads over images.',
        'gradient-fade': 'Use gradient transitions from image to solid color for text areas.',
        'clear-space': 'Position text in image-free zones — do not overlay text on busy image areas.',
        'knockout': 'Use knockout/reversed text directly over images — requires high-contrast imagery.',
      }
      sections.push(`**Text over images:** ${overlayGuide[dna.image_treatment.text_overlay] || dna.image_treatment.text_overlay}`)
    }
    sections.push('')
  }

  // Project instructions (generated from use case)
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

  // Hardcoded anti-slop (Level 3)
  sections.push(WEB_ANTI_SLOP)
  sections.push('')
  sections.push(WEB_IMPLEMENTATION)

  return sections.join('\n')
}

function formatImageGenSkill(dna: ImageGenDNA, useCase?: string): string {
  const sections: string[] = []

  // Identity
  sections.push(`# Visual Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  if (useCase) {
    sections.push(`>`)
    sections.push(`> Creating: ${useCase}`)
  }
  sections.push('')

  // Core parameters
  sections.push(`## Visual Identity`)
  sections.push(`**Medium:** ${dna.medium_type.primary} — ${dna.medium_type.sub_tags.join(', ')}`)
  sections.push(`**Mood:** ${dna.mood_tags.join(' · ')}`)
  sections.push(`**Palette:** ${dna.color_palette.mood} — ${dna.color_palette.colors.join(', ')}`)
  sections.push('')

  // Lighting — professional vocabulary
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
  sections.push(`## Visual Boundaries`)
  sections.push(`These define what this aesthetic is NOT:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **DO:** ${ap.this_is}`)
    sections.push(`  **NEVER:** ${ap.not_that}`)
  }
  sections.push('')

  // Hardcoded anti-slop
  sections.push(IMAGE_GEN_ANTI_SLOP)
  sections.push('')
  sections.push(IMAGE_GEN_IMPLEMENTATION)

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
