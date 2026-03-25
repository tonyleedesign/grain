// Export formatters - generate skill.md files that instruct LLMs on design behavior.
// Based on research: Anthropic's frontend-design skill structure, typeui.sh patterns,
// and anti-slop techniques. The export is a behavioral contract, not just tokens.

import type { WebAppDNA, ImageGenDNA, Medium } from '@/types/dna'
import { generateShadcnTheme } from './theme-generator'

// --- Formatters ---

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
  sections.push('')


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
  if (dna.positioning) {
    sections.push(`## Positioning`)
    sections.push(dna.positioning)
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
  // Theme recommendation
  if (dna.theme_recommendation) {
    sections.push(`## Theme`)
    sections.push(`**Library:** ${dna.theme_recommendation.library}`)
    if (dna.theme_recommendation.theme_preset) {
      sections.push(`**Preset:** ${dna.theme_recommendation.theme_preset}`)
    }
    sections.push(`**Why:** ${dna.theme_recommendation.rationale}`)
    sections.push('')
    sections.push(`**Components:** ${dna.theme_recommendation.component_notes}`)
    sections.push('')
    // Generate shadcn CSS variables from DNA tokens
    if (!dna.theme_recommendation.theme_preset) {
      sections.push('**CSS Variables (shadcn theme):**')
      sections.push('```css')
      sections.push(generateShadcnTheme(dna.color_palette.colors, dna.border_radius))
      sections.push('```')
      sections.push('')
    }
  }

  // Composition & Layout
  if (dna.composition_layout) {
    sections.push(`## Composition & Layout`)
    sections.push(`**Page archetype:** ${dna.composition_layout.page_archetype}`)
    sections.push(`**Structure:** ${dna.composition_layout.structure}`)
    sections.push(`**Spatial rules:** ${dna.composition_layout.spatial_rules}`)
    sections.push(`**Responsive:** ${dna.composition_layout.responsive_notes}`)
    sections.push('')
  }

  // Design thinking - attitude, not just tokens
  sections.push(`## Design Thinking`)
  sections.push(`**Mood:** ${dna.mood_tags.join(' | ')}`)
  sections.push(`**Palette relationship:** ${dna.color_palette.relationship}`)
  sections.push(`**Spatial feel:** ${dna.spacing_density} density, ${dna.shadow_style} shadows, ${dna.border_radius}px radius`)
  sections.push('')
  sections.push('')

  // Anti-patterns from DNA (personalized)
  sections.push(`## Direction Boundaries`)
  sections.push(`These are guardrails that keep the work aligned. Favor the first quality and avoid drifting into the second:`)
  sections.push('')
  for (const ap of dna.anti_patterns) {
    sections.push(`- **Favor:** ${ap.this_is}`)
    sections.push(`  **Avoid drifting into:** ${ap.not_that}`)
  }
  sections.push('')

  // Color system - literal values
  sections.push(`## Color System`)
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

  // Typography - with implementation guidance
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

  sections.push(`## Implementation`)
  sections.push(`Implement the exported values as reusable tokens, not one-off hardcoded styles. Match implementation complexity to the direction - do not default to generic component patterns that flatten the aesthetic.`)
  sections.push('')

  return sections.join('\n')
}

function formatImageGenSkill(dna: ImageGenDNA, useCase?: string): string {
  const sections: string[] = []

  // Identity
  sections.push(`# Visual Direction: ${dna.board_name}`)
  sections.push('')
  sections.push(`> ${dna.direction_summary}`)
  sections.push('')

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
