# Export Formatter Tightening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce interpretation drift in downstream AI tools by adding priority signaling, implementation precision, and authority to the 4 export formatter functions.

**Architecture:** All changes are in `src/lib/export-formatters.ts`. Four functions get updated: `formatReadme`, `formatStyle`, `formatComposition`, `formatAssets`. No schema changes, no UI changes, no new files. A small helper `buildGoogleFontsUrl` is added within the same file.

**Tech Stack:** TypeScript, existing DNA types from `src/types/dna.ts`

**Verification:** `npx tsc --noEmit` + manual browser test (extract DNA, check export preview for each tab)

---

### Task 1: Update `formatReadme` — Priority preamble, Decision Sheet, Non-Negotiables, Required Stack

**Files:**
- Modify: `src/lib/export-formatters.ts:26-102`

- [ ] **Step 1: Add priority preamble after the direction summary**

In `formatReadme`, after the `> ${dna.direction_summary}` line (line 31), add:

```typescript
  sections.push(`> **Priority: EXACT** — This file defines the project contract. style.md, composition.md, and assets.md support it. If files conflict, this one wins.`)
  sections.push('')
```

- [ ] **Step 2: Add Decision Sheet section after Project Instructions**

After the closing `}` of the `project_instructions` block (after line 62), add a new Decision Sheet section:

```typescript
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
```

- [ ] **Step 3: Add Non-Negotiables section after Decision Sheet**

Immediately after the Decision Sheet, add:

```typescript
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
```

- [ ] **Step 4: Change "Recommended Stack" to "Required Stack"**

Replace the current theme_recommendation block (lines 70-82):

Current:
```typescript
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
```

New:
```typescript
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
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `export-formatters.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: add priority preamble, decision sheet, non-negotiables to README formatter"
```

---

### Task 2: Update `formatStyle` — Priority preamble, Google Fonts @import, fallback classification

**Files:**
- Modify: `src/lib/export-formatters.ts` (the `formatStyle` function and new helper)

- [ ] **Step 1: Add `buildGoogleFontsUrl` helper**

Add this helper function before `formatStyle` (after line 102):

```typescript
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
```

- [ ] **Step 2: Add priority preamble to `formatStyle`**

In `formatStyle`, after the `# Style Tokens` heading and empty line (after line 108), add:

```typescript
  sections.push(`> **Priority: EXACT** — These are implementation tokens. Apply them exactly as specified. Do not approximate or substitute.`)
  sections.push('')
```

- [ ] **Step 3: Add Google Fonts @import after typography CSS block**

After the typography CSS closing block and the "Display font is for headlines..." line (after line 147), add:

```typescript
  sections.push(`Load both fonts from Google Fonts:`)
  sections.push('```')
  sections.push(`@import url('${buildGoogleFontsUrl(dna)}');`)
  sections.push('```')
  sections.push('')
  const displayClassification = dna.typography.display.classification
  sections.push(`If the display font fails to load, the fallback must preserve the classification — substitute another ${displayClassification}, not a generic sans-serif.`)
  sections.push('')
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `export-formatters.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: add priority preamble and Google Fonts import to style formatter"
```

---

### Task 3: Update `formatComposition` — Priority preamble, structural clarity

**Files:**
- Modify: `src/lib/export-formatters.ts` (the `formatComposition` function)

- [ ] **Step 1: Add priority preamble to `formatComposition`**

In `formatComposition`, after the `# Composition` heading and empty line (after line 179), add:

```typescript
  sections.push(`> **Priority: DIRECTIONAL** — This is creative direction. Use your judgment within these boundaries. Layout decisions, section transitions, and motion choreography are yours to determine — but stay within the described feel.`)
  sections.push('')
```

- [ ] **Step 2: Add structural clarity guidance after the Layout block**

After the closing of the `composition_layout` block (after line 188, after the empty string push), add:

```typescript
  sections.push(`Sections may be full-width, boxed, overlapping, or nested — choose what fits the archetype above. Maintain visual consistency in navigation and typography across sections, but allow deliberate variation in background treatment, density, and composition between sections.`)
  sections.push('')
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `export-formatters.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: add priority preamble and structural clarity to composition formatter"
```

---

### Task 4: Update `formatAssets` — Priority preamble, image scope, stronger incorporation

**Files:**
- Modify: `src/lib/export-formatters.ts` (the `formatAssets` function)

- [ ] **Step 1: Replace the `formatAssets` function**

Replace the entire `formatAssets` function (lines 252-284) with:

```typescript
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
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors related to `export-formatters.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: add priority preamble, scope labels, and stronger incorporation to assets formatter"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Browser test — extract and preview**

1. Start dev server (`npm run dev`)
2. Open a board with images
3. Run extraction
4. Check each export tab (Read Me, Style, Composition, Assets) and verify:
   - README shows: Priority preamble, Decision Sheet, Non-Negotiables, "Required Stack"
   - Style shows: Priority preamble, Google Fonts `@import` URL, fallback classification line
   - Composition shows: Priority preamble, structural clarity line after Layout
   - Assets shows: Priority preamble, Scope (Global/Section) per image, stronger incorporation text

- [ ] **Step 3: Test download package**

Click download — verify the zip contains the updated file contents.

- [ ] **Step 4: Final commit if any fixes needed**
