# Tier 2: Folder Export + Image Classification

## Problem

The current export is a single monolithic text blob copied to clipboard. This has two issues:

1. **File length** — the single export is getting long as we add more DNA fields (theme recommendation, composition, creative direction). Consuming AIs work better with focused, shorter files.
2. **Non-text assets** — reference images can't travel through clipboard. When images informed the direction, the downstream AI loses that context entirely.

## Solution

Replace the single clipboard export with a **4-file download package** plus **AI-driven image classification** so the consuming tool gets structured, focused files and (when appropriate) the reference images that informed the direction.

---

## Part 1: 4-File Export Package

### File Structure

**README.md** — Project brief and high-level direction
- Board name + direction summary
- Project instructions (if use case was provided): project summary, sections, content tone, standout tips
- Positioning statement
- Frontend library recommendation + rationale
- Anti-patterns (favor X / avoid Y pairs)
- Mood tags

**style.md** — Visual tokens and design system
- Color system: CSS variables, relationship description, overlay intents
- Typography: display + body families, weights, classifications, CSS variables
- Spatial rules: border radius, density, shadows
- Texture & surface: surface feel, light/depth, texture strategy
- Generated shadcn theme CSS (when applicable, i.e. no DaisyUI preset)

**composition.md** — Layout, motion, and creative direction
- Composition layout: page archetype, structure, spatial rules, responsive notes
- Creative direction: per-section scene descriptions
- Motion & animation: level, techniques, approach
- Image treatment direction: role, treatment, placement, text overlay

**assets.md** — Reference images and usage guidance (conditional)
- Only generated when at least one image is marked for inclusion
- Image roles with descriptions (how to use each: hero, background, texture, etc.)
- Each included image is listed as a markdown image embed using its original URL: `![role description](url)`
- If ALL images are style references (none checked), this file is omitted — download is 3 files

### Design Principles

- Each file is self-contained and useful on its own
- A consuming AI can be given just `style.md` for token work, or just `composition.md` for layout
- No duplication between files — each piece of DNA lives in exactly one file
- Composition descriptions are freeform (no banned archetypes — grids are fine when the images call for them)

---

## Part 2: Image Classification

### How It Works

**During extraction (Pass 2):** The AI classifies each reference image into one of two roles:

- `usable_asset` — The image IS content: a photo, illustration, icon, or texture that belongs in the final product
- `style_reference` — The image shows a vibe, layout, color scheme, or design pattern to draw from, not to embed literally

**New field on WebAppDNA:**

```typescript
image_roles?: Array<{
  image_index: number
  role: 'usable_asset' | 'style_reference'
  description: string  // How to use it or what it informed
}>
```

**Classification rules in the extraction prompt:**
- `usable_asset`: The image is content — a photograph, illustration, icon, or texture meant to appear in the final design
- `style_reference`: The image demonstrates a style, layout pattern, color scheme, or mood — it informs direction but isn't embedded
- When ambiguous, default to `style_reference` (safer — you can promote but harder to demote)
- If the user's use case explicitly mentions using the images in the design, bias toward `usable_asset`

**Index mapping:** `image_index` is 0-based and corresponds to the position in the `imageUrls` array passed to extraction. Any `image_roles` entry with an out-of-bounds `image_index` is silently ignored.

**Backward compatibility:** When `image_roles` is undefined (boards extracted before this feature ships), all images default to `style_reference` (unchecked). Users can still manually check images to include them.

**User override:** Checkboxes on image thumbnails in the Export tab. AI sets the default checked/unchecked state, user can toggle before downloading. No re-extraction needed.

---

## Part 3: Export Tab UI Redesign

### Current State

- Format toggle ("Skill.md" / "Midjourney") — Skill.md button does nothing on web medium since it's the only option
- Single pre block with monolithic output
- Copy button
- Feedback prompt after copy

### New Design

**Layout (top to bottom):**

1. **File tabs**: README | Style | Composition | Assets
   - Assets tab greyed out / hidden when no images are checked for inclusion
   - Replaces the old format toggle (Skill.md / Midjourney)
   - **Web medium only.** Image medium retains its current export UI (single Midjourney prompt + copy) — the 4-file structure does not apply to ImageGenDNA

2. **File preview**: Pre block showing the selected file's content
   - Same styling as current (monospace, 11px, 400px max height, scroll)
   - Copy button per file (top-right of pre block, same as current)

3. **Image checkboxes** (below file preview, only when board has images):
   - Row of image thumbnails with checkboxes
   - Checked = include in assets.md download
   - Default state set by AI classification (`usable_asset` = checked, `style_reference` = unchecked)
   - Updating checkboxes regenerates the Assets tab preview in real time

4. **"Download Package" button**: At the bottom of the Export tab
   - Triggers 3 or 4 simultaneous browser downloads (no zip, no folder picker)
   - Downloads: README.md, style.md, composition.md, and assets.md (if images checked)
   - Standard browser download behavior — files land in user's Downloads folder

**Prop changes:** `ExportView` must accept `imageUrls: string[]` as a new prop. `DNAPanelV2` already has `imageUrls` in state — wire it through to `ExportView`.

**Action buttons (bottom of panel, unchanged):**
- Regenerate, Edit DNA, Apply to Grain, Export DNA
- "Export DNA" stays in the bottom action grid — switches to Export tab (same behavior as today)

### Download Mechanism

Simple `document.createElement('a')` + click pattern for each file. No zip library, no File System Access API. Downloads are staggered by 100ms to avoid browser popup blockers that may flag rapid simultaneous downloads.

```typescript
function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Part 4: Formatter Changes

### Current State

`src/lib/export-formatters.ts` has two formatters:
- `formatForCodeTools()` → single skill.md string
- `formatForMidjourney()` → single Midjourney prompt string

### New Formatters

Replace `formatForCodeTools()` with four focused formatters:

- `formatReadme(dna, useCase?)` → README.md content
- `formatStyle(dna)` → style.md content
- `formatComposition(dna)` → composition.md content
- `formatAssets(dna, imageUrls, checkedIndices)` → assets.md content (only checked images)

Keep `formatForMidjourney()` unchanged (image medium only).

Keep `formatForCodeTools()` as a backward-compat wrapper that calls `formatReadme` + `formatStyle` + `formatComposition` (no assets — it has no image context). Signature stays the same: `(dna, medium, useCase?)`.

### Section Mapping (current → new files)

| Current `formatWebSkill` section | New file |
|---|---|
| Identity (board name, direction summary) | README.md |
| Project Instructions | README.md |
| Positioning | README.md |
| Creative Direction | composition.md |
| Theme | README.md (library rec + rationale) and style.md (generated CSS variables) |
| Composition & Layout | composition.md |
| Design Thinking (mood, relationship, spatial feel) | README.md (mood tags) — spatial feel covered in style.md |
| Direction Boundaries (anti-patterns) | README.md |
| Color System | style.md |
| Typography | style.md |
| Spatial Rules | style.md |
| Texture & Surface | style.md |
| Motion & Animation | composition.md |
| Image Direction | composition.md |
| Implementation | README.md (brief note) |

---

## Part 5: Type Changes

### WebAppDNA (src/types/dna.ts)

Add one new optional field:

```typescript
image_roles?: Array<{
  image_index: number
  role: 'usable_asset' | 'style_reference'
  description: string
}>
```

### No changes to ImageGenDNA

Image generation DNA doesn't have the same export structure — it stays as-is with the Midjourney formatter.

---

## Scope and Non-Goals

**In scope:**
- 4-file export with download
- Image classification (AI + user override)
- Export tab UI redesign with file tabs
- New focused formatters
- Type addition for image_roles

**Not in scope (future work):**
- Actual image file downloads (binary assets) — text references only for now
- Direct integration with AI tools (Cursor, Claude, etc.)
- Zip packaging
- Drag-and-drop export
- Image editing/cropping in the panel
