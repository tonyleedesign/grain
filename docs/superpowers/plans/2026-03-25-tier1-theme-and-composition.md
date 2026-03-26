# Tier 1: Theme Matching + Composition Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add frontend library/theme matching and structural composition guidance to the DNA pipeline, so downstream tools get a scoped starting point (shadcn theme config + component recommendations) and clear layout architecture instead of just abstract tokens.

**Architecture:** Two new fields on WebAppDNA: `theme_recommendation` (AI picks library + aesthetic, code generates CSS variables at export time) and `composition_layout` (4 descriptive fields capturing page structure). Both flow through the standard pipeline: type → prompt → export → panel component → wiring. A utility function converts DNA color tokens to shadcn HSL variables mechanically — the LLM decides what, code handles the conversion.

**Tech Stack:** TypeScript, Next.js, Tailwind CSS, Claude Sonnet 4.6 (extraction), lucide-react (icons)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/dna.ts` | Modify | Add `theme_recommendation` and `composition_layout` to WebAppDNA |
| `src/app/api/extract-dna/prompts.ts` | Modify | Add both fields to JSON schema template + extraction rules |
| `src/lib/export-formatters.ts` | Modify | Add Theme and Composition sections to skill.md export |
| `src/lib/theme-generator.ts` | Create | Utility: convert DNA tokens → shadcn CSS variables (hex→HSL) |
| `src/components/dna/fields/ThemeRecommendationField.tsx` | Create | Panel component for theme recommendation display |
| `src/components/dna/fields/CompositionLayoutField.tsx` | Create | Panel component for composition layout display |
| `src/components/dna/layouts/WebAppDesignerView.tsx` | Modify | Wire both new field components into the panel layout |

---

### Task 1: Type Definitions

**Files:**
- Modify: `src/types/dna.ts`

- [ ] **Step 1: Add `theme_recommendation` to WebAppDNA**

After the `creative_direction` field (~line 41), add:

```typescript
  theme_recommendation?: {
    library: string           // e.g. "shadcn", "shadcn + aceternity-ui", "shadcn + magic-ui", "daisyui"
    theme_preset?: string     // for DaisyUI: named theme like "retro", "cyberpunk", "pastel". null for custom shadcn
    rationale: string         // why this library/theme fits the board's aesthetic
    component_notes: string   // which components to use, which variants, what to avoid
  }
```

- [ ] **Step 2: Add `composition_layout` to WebAppDNA**

After `theme_recommendation`, add:

```typescript
  composition_layout?: {
    page_archetype: string      // what kind of page this is and how it's organized (e.g. "Single-page scroll with full-bleed hero, masonry gallery, and minimal footer")
    structure: string           // how sections relate, what dominates, grid vs freeform, section rhythm
    spatial_rules: string       // overlap behavior, depth layering, alignment, container discipline, whitespace role
    responsive_notes: string    // what must survive on small screens, what can reflow or collapse, breakpoint priorities
  }
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: clean, no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/dna.ts
git commit -m "feat: add theme_recommendation and composition_layout types to WebAppDNA"
```

---

### Task 2: Theme Generator Utility

**Files:**
- Create: `src/lib/theme-generator.ts`

- [ ] **Step 1: Create the hex-to-HSL converter and shadcn variable generator**

This utility takes DNA color tokens + border_radius and produces a shadcn CSS variables block. The LLM never generates CSS — this is mechanical conversion.

```typescript
/**
 * Converts DNA color tokens into a shadcn/ui CSS variables block.
 * Maps DNA semantic roles (primary, secondary, accent, dark, light)
 * to shadcn semantic slots (primary, secondary, accent, muted, background, foreground, etc.)
 */

interface DNAColor {
  hex: string
  role: string
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  // Handle 3-char shorthand (#FFF → FFFFFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length !== 6) return { h: 0, s: 0, l: 50 } // fallback for invalid input
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360 * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  }
}

function hslString(hsl: { h: number; s: number; l: number }): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`
}

function lighten(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: hsl.s, l: Math.min(100, hsl.l + amount) }
}

function darken(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: hsl.s, l: Math.max(0, hsl.l - amount) }
}

function desaturate(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: Math.max(0, hsl.s - amount), l: hsl.l }
}

export function generateShadcnTheme(
  colors: DNAColor[],
  borderRadius: number
): string {
  // Map DNA roles to colors
  const primary = colors.find(c => c.role === 'primary')
  const secondary = colors.find(c => c.role === 'secondary')
  const accent = colors.find(c => c.role === 'accent')
  const dark = colors.find(c => c.role === 'dark')
  const light = colors.find(c => c.role === 'light')

  // Fallbacks
  const primaryHSL = primary ? hexToHSL(primary.hex) : { h: 0, s: 0, l: 20 }
  const secondaryHSL = secondary ? hexToHSL(secondary.hex) : desaturate(lighten(primaryHSL, 40), 30)
  const accentHSL = accent ? hexToHSL(accent.hex) : { h: (primaryHSL.h + 30) % 360, s: primaryHSL.s, l: primaryHSL.l }
  const darkHSL = dark ? hexToHSL(dark.hex) : darken(primaryHSL, 60)
  const lightHSL = light ? hexToHSL(light.hex) : { h: primaryHSL.h, s: Math.min(primaryHSL.s, 10), l: 98 }

  // Radius mapping
  const radiusRem = borderRadius <= 0 ? '0' :
                    borderRadius <= 4 ? '0.25rem' :
                    borderRadius <= 8 ? '0.5rem' :
                    borderRadius <= 12 ? '0.625rem' :
                    borderRadius <= 16 ? '0.75rem' :
                    borderRadius <= 20 ? '1rem' : '1.25rem'

  const lines = [
    ':root {',
    `  --background: ${hslString(lightHSL)};`,
    `  --foreground: ${hslString(darkHSL)};`,
    `  --card: ${hslString(lighten(lightHSL, 1))};`,
    `  --card-foreground: ${hslString(darkHSL)};`,
    `  --popover: ${hslString(lightHSL)};`,
    `  --popover-foreground: ${hslString(darkHSL)};`,
    `  --primary: ${hslString(primaryHSL)};`,
    `  --primary-foreground: ${hslString(primaryHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --secondary: ${hslString(secondaryHSL)};`,
    `  --secondary-foreground: ${hslString(secondaryHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --muted: ${hslString(desaturate(lighten(primaryHSL, 35), 25))};`,
    `  --muted-foreground: ${hslString(desaturate(primaryHSL, 20))};`,
    `  --accent: ${hslString(accentHSL)};`,
    `  --accent-foreground: ${hslString(accentHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --destructive: 0 84.2% 60.2%;`,
    `  --destructive-foreground: 0 0% 98%;`,
    `  --border: ${hslString(desaturate(lighten(primaryHSL, 30), 20))};`,
    `  --input: ${hslString(desaturate(lighten(primaryHSL, 30), 20))};`,
    `  --ring: ${hslString(primaryHSL)};`,
    `  --radius: ${radiusRem};`,
    '}',
  ]

  return lines.join('\n')
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/lib/theme-generator.ts
git commit -m "feat: add shadcn theme generator utility (hex to HSL conversion)"
```

---

### Task 3: Prompt Changes

**Files:**
- Modify: `src/app/api/extract-dna/prompts.ts`

- [ ] **Step 1: Add `theme_recommendation` to the JSON schema template**

In `buildWebAppSynthesizePrompt()`, find the JSON schema template. After the `"creative_direction"` block and before `"anti_patterns"`, add:

```json
  "theme_recommendation": {
    "library": "shadcn | shadcn + aceternity-ui | shadcn + magic-ui | shadcn + motion-primitives | daisyui | shadcn + 8bitcn",
    "theme_preset": "For DaisyUI only: retro | cyberpunk | synthwave | pastel | luxury | valentine | aqua | lofi | etc. null for custom shadcn.",
    "rationale": "Why this library and theme fits the board aesthetic.",
    "component_notes": "Which components to prioritize, which variants (ghost/outline/filled), what patterns to use or avoid."
  },
```

- [ ] **Step 2: Add `composition_layout` to the JSON schema template**

After `theme_recommendation`, add:

```json
  "composition_layout": {
    "page_archetype": "Describe the page type and overall organization in one vivid sentence.",
    "structure": "How sections are organized, what dominates, grid vs freeform, section rhythm and flow.",
    "spatial_rules": "Overlap behavior, depth layering, alignment, container discipline, whitespace role.",
    "responsive_notes": "What must survive on small screens, what can reflow, breakpoint priorities."
  },
```

- [ ] **Step 3: Add extraction rules**

In the Rules section (after the existing rules, before `REJECT:`), add these two rules:

```
- theme_recommendation: Pick the frontend library that best matches the overall aesthetic and motion level. Default to shadcn for clean/minimal/professional. Add aceternity-ui or magic-ui for animation-heavy or marketing-focused boards. Add motion-primitives for tasteful subtle motion. Use daisyui only when a named theme preset is an obvious match (retro, cyberpunk, synthwave, etc.). Use 8bitcn for pixel-art or retro-game aesthetics. component_notes should describe which component patterns to use (e.g. "ghost buttons, bordered cards, horizontal tab navigation") and which to avoid, grounded in what the observations show.
- composition_layout: All four fields should be vivid descriptions grounded in observations, not selections from a fixed menu. page_archetype names the structural shape. structure describes how sections flow and what leads. spatial_rules captures overlap, alignment, and container discipline. responsive_notes identifies what must be preserved vs what can reflow. Avoid generic descriptions that could apply to any design.
```

- [ ] **Step 4: Add composition_layout and theme_recommendation to the sentence-length exception**

Find the REJECT line:
```
- REJECT: sentences longer than 6 words (except direction_summary and creative_direction entries), vague adjectives, metaphors.
```

Update to:
```
- REJECT: sentences longer than 6 words (except direction_summary, creative_direction entries, composition_layout fields, and theme_recommendation fields), vague adjectives, metaphors.
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add src/app/api/extract-dna/prompts.ts
git commit -m "feat: add theme_recommendation and composition_layout to extraction prompt"
```

---

### Task 4: Export Formatter

**Files:**
- Modify: `src/lib/export-formatters.ts`

- [ ] **Step 1: Import the theme generator**

At the top of the file, add:

```typescript
import { generateShadcnTheme } from './theme-generator'
```

- [ ] **Step 2: Add Theme section to the export**

In `formatWebSkill()`, after the Creative Direction section (after the `creative_direction` block, ~line 72) and before the Design Thinking section, add:

```typescript
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
```

- [ ] **Step 3: Add Composition & Layout section to the export**

After the Theme section, before Design Thinking, add:

```typescript
  // Composition & Layout
  if (dna.composition_layout) {
    sections.push(`## Composition & Layout`)
    sections.push(`**Page archetype:** ${dna.composition_layout.page_archetype}`)
    sections.push(`**Structure:** ${dna.composition_layout.structure}`)
    sections.push(`**Spatial rules:** ${dna.composition_layout.spatial_rules}`)
    sections.push(`**Responsive:** ${dna.composition_layout.responsive_notes}`)
    sections.push('')
  }
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: add theme and composition sections to skill.md export"
```

---

### Task 5: Panel Components

**Files:**
- Create: `src/components/dna/fields/ThemeRecommendationField.tsx`
- Create: `src/components/dna/fields/CompositionLayoutField.tsx`

- [ ] **Step 1: Create ThemeRecommendationField**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Palette } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface ThemeRecommendationFieldProps {
  themeRecommendation: NonNullable<WebAppDNA['theme_recommendation']>
}

export function ThemeRecommendationField({ themeRecommendation }: ThemeRecommendationFieldProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Palette size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Theme</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 pl-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'var(--color-bg)',
              }}
            >
              {themeRecommendation.library}
            </span>
            {themeRecommendation.theme_preset && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {themeRecommendation.theme_preset}
              </span>
            )}
          </div>
          <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
            {themeRecommendation.rationale}
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Components</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {themeRecommendation.component_notes}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create CompositionLayoutField**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, LayoutGrid } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface CompositionLayoutFieldProps {
  compositionLayout: NonNullable<WebAppDNA['composition_layout']>
}

export function CompositionLayoutField({ compositionLayout }: CompositionLayoutFieldProps) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <LayoutGrid size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Composition & Layout</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2.5 pl-1">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Archetype</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.page_archetype}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Structure</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.structure}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Spatial Rules</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.spatial_rules}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--color-text)' }}>Responsive</div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
              {compositionLayout.responsive_notes}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add src/components/dna/fields/ThemeRecommendationField.tsx src/components/dna/fields/CompositionLayoutField.tsx
git commit -m "feat: add ThemeRecommendation and CompositionLayout panel components"
```

---

### Task 6: Wire Components into Panel Layout

**Files:**
- Modify: `src/components/dna/layouts/WebAppDesignerView.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:

```typescript
import { ThemeRecommendationField } from '../fields/ThemeRecommendationField'
import { CompositionLayoutField } from '../fields/CompositionLayoutField'
```

- [ ] **Step 2: Add ThemeRecommendationField after CreativeDirectionField**

Find the CreativeDirectionField rendering block. After its closing `</>`, add:

```tsx
{dna.theme_recommendation && (
  <>
    <Divider />
    <ThemeRecommendationField themeRecommendation={dna.theme_recommendation} />
  </>
)}
```

- [ ] **Step 3: Add CompositionLayoutField after ThemeRecommendationField**

Immediately after the theme block:

```tsx
{dna.composition_layout && (
  <>
    <Divider />
    <CompositionLayoutField compositionLayout={dna.composition_layout} />
  </>
)}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/components/dna/layouts/WebAppDesignerView.tsx
git commit -m "feat: wire ThemeRecommendation and CompositionLayout into DNA panel"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Type check the full project**

Run: `npx tsc --noEmit`
Expected: clean, zero errors

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: compiles without errors

- [ ] **Step 3: Test extraction on a real board**

1. Open a board with reference images
2. Select web medium
3. Run extraction
4. Verify the DNA panel shows:
   - Theme section with library name, optional preset tag, rationale, component notes
   - Composition & Layout section with archetype, structure, spatial rules, responsive notes
5. Verify the Export tab includes:
   - `## Theme` section with library, CSS variables block, component notes
   - `## Composition & Layout` section with all four fields

- [ ] **Step 4: Verify theme CSS variables are valid**

Copy the generated CSS variables from the export. Paste into a test HTML file or browser devtools. Verify:
- All values are valid HSL format (e.g. `222.2 47.4% 11.2%`)
- Radius value is a valid rem unit
- Foreground colors contrast against their background counterparts

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: tier 1 complete — theme matching + composition layout in DNA pipeline"
```
