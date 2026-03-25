# Creative Direction Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `creative_direction` field to WebAppDNA that generates section-level scene descriptions, giving downstream LLMs vivid enough visual direction to build each section without ever seeing the reference images.

**Architecture:** Additive change to the existing two-pass extraction. Pass 2 already has the observations (from Pass 1) and the project sections (from user input). We add a prompt instruction telling Pass 2 to generate a `creative_direction` array alongside the existing DNA fields. The export formatter renders it as a new `## Creative Direction` section. A new panel component displays it in the DNA panel.

**Tech Stack:** TypeScript, Next.js, React, Anthropic Claude API (existing pipeline)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/dna.ts` | Modify | Add `creative_direction` field to `WebAppDNA` |
| `src/app/api/extract-dna/prompts.ts` | Modify | Add `creative_direction` to Pass 2 JSON schema + prompt rules |
| `src/lib/export-formatters.ts` | Modify | Render `## Creative Direction` section in web skill export |
| `src/components/dna/fields/CreativeDirectionField.tsx` | Create | Panel component to display creative direction per section |
| `src/components/dna/layouts/WebAppDesignerView.tsx` | Modify | Import and render `CreativeDirectionField` |

No changes to `route.ts` — the field flows through the existing `dna` JSON object automatically.

---

### Task 1: Add type definition

**Files:**
- Modify: `src/types/dna.ts:35-84` (WebAppDNA interface)

- [ ] **Step 1: Add creative_direction to WebAppDNA**

Add after `positioning` (line 37), before `color_palette`:

```typescript
  creative_direction?: Array<{
    section: string    // section name matching project_instructions.sections
    direction: string  // vivid scene description: assets, composition, background, overlays
  }>
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/types/dna.ts
git commit -m "feat: add creative_direction type to WebAppDNA"
```

---

### Task 2: Add creative_direction to Pass 2 prompt

**Files:**
- Modify: `src/app/api/extract-dna/prompts.ts:200-288` (buildWebAppSynthesizePrompt)

- [ ] **Step 1: Add creative_direction to the JSON schema template**

In `buildWebAppSynthesizePrompt`, add `creative_direction` to the JSON structure after `project_instructions` (after line 256):

```json
  "creative_direction": [
    {
      "section": "Section name from project_instructions.sections",
      "direction": "Scene description: what visual materials appear, what the composition feels like, what kind of assets belong here. Vivid enough that a developer who has never seen the reference images can build it."
    }
  ],
```

- [ ] **Step 2: Add prompt rules for creative_direction**

Add to the Rules block (after the `project_instructions` rule at line 276):

```
- creative_direction: Write entries for sections that most depend on imagery, composition, or asset world. Hero and showcase sections should be the richest. Utility sections like contact or footer may be brief or omitted if they do not need strong art direction. Use short section labels (e.g. "Hero", "Projects", "Gallery"), not the full section description from project_instructions. Be vivid about what visual materials appear: subject type, asset type, collage elements, background world, and supporting overlays. Describe the visual scene and asset world, not CSS, coordinates, or interaction code. Composition words like centered, off-center, layered, scattered, close-up, full-bleed, or background-led are allowed — exact pixel placement is not. Do not reference images by number — describe what things look like, not which reference they came from. Distinguish between surface texture (paper-crumple, concrete) and image content (outdoor portraits, concert photography).
```

- [ ] **Step 2b: Update the sentence-length rejection rule**

Line 282 currently reads: `- REJECT: sentences longer than 6 words (except direction_summary), vague adjectives, metaphors.`

Change to: `- REJECT: sentences longer than 6 words (except direction_summary and creative_direction entries), vague adjectives, metaphors.`

This is critical — `creative_direction` entries are multi-sentence scene descriptions. Without this exception, the model will be told to write vivid prose while also rejecting sentences over 6 words.

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extract-dna/prompts.ts
git commit -m "feat: add creative_direction to Pass 2 prompt schema and rules"
```

---

### Task 3: Add creative_direction to export formatter

**Files:**
- Modify: `src/lib/export-formatters.ts:60-64` (after Positioning section in formatWebSkill)

- [ ] **Step 1: Add Creative Direction section to the web skill export**

After the Positioning block's closing brace (line 64 — the `}` that closes `if (dna.positioning)`) and before the Design Thinking comment (line 65), add. **Important:** this must go OUTSIDE the `if (dna.positioning)` block so creative direction renders independently:

```typescript
  if (dna.creative_direction?.length) {
    sections.push(`## Creative Direction`)
    for (const cd of dna.creative_direction) {
      sections.push(`**${cd.section}**`)
      sections.push(cd.direction)
      sections.push('')
    }
  }
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-formatters.ts
git commit -m "feat: render creative_direction in web skill export"
```

---

### Task 4: Create CreativeDirectionField panel component

**Files:**
- Create: `src/components/dna/fields/CreativeDirectionField.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Clapperboard } from 'lucide-react'
import type { WebAppDNA } from '@/types/dna'

interface CreativeDirectionFieldProps {
  creativeDirection: NonNullable<WebAppDNA['creative_direction']>
}

export function CreativeDirectionField({ creativeDirection }: CreativeDirectionFieldProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 mb-2 cursor-pointer"
        style={{ color: 'var(--color-text)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Clapperboard size={14} style={{ color: 'var(--color-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          Creative Direction
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 pl-1">
          {creativeDirection.map((cd, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div
                className="text-[11px] font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {cd.section}
              </div>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: 'var(--color-muted)' }}
              >
                {cd.direction}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/dna/fields/CreativeDirectionField.tsx
git commit -m "feat: add CreativeDirectionField panel component"
```

---

### Task 5: Wire CreativeDirectionField into WebAppDesignerView

**Files:**
- Modify: `src/components/dna/layouts/WebAppDesignerView.tsx`

- [ ] **Step 1: Import CreativeDirectionField**

Add to imports (after line 13):

```typescript
import { CreativeDirectionField } from '../fields/CreativeDirectionField'
```

- [ ] **Step 2: Render CreativeDirectionField after direction summary, before first Divider**

After the direction summary `<p>` (line 35) and before the first `<Divider />` (line 37), add:

```tsx
      {dna.creative_direction && dna.creative_direction.length > 0 && (
        <>
          <Divider />
          <CreativeDirectionField creativeDirection={dna.creative_direction} />
        </>
      )}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/dna/layouts/WebAppDesignerView.tsx
git commit -m "feat: render creative direction in DNA panel"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors across the project

- [ ] **Step 2: Run dev server**

Run: `npm run dev`
Expected: Server starts without errors

- [ ] **Step 3: Test extraction on a real board**

Trigger a DNA extraction on an image-heavy board (e.g., the fan-zine portfolio board). Verify:
- The returned DNA JSON includes `creative_direction` as an array
- Each entry has `section` and `direction` fields
- Section names correspond to `project_instructions.sections`
- Directions are vivid scene descriptions, not abstract mood summaries
- No "image 1" / "image 2" references in the direction text
- Hero/showcase sections have richer descriptions than utility sections
- Surface texture and image content are distinguished

- [ ] **Step 4: Verify panel rendering**

Open the DNA panel after extraction. Verify:
- Creative Direction section appears after the direction summary
- Each section name is displayed as a label
- Direction prose is readable and not truncated
- Collapsible toggle works

- [ ] **Step 5: Verify export**

Copy the exported skill.md. Verify:
- `## Creative Direction` section appears after Positioning
- Each section is a bold label followed by its direction prose
- The creative direction is self-contained (makes sense without seeing images)

- [ ] **Step 6: Commit any fixes**

If any adjustments were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: adjustments from creative direction e2e testing"
```
