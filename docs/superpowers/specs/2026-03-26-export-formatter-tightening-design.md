# Export Formatter Tightening — Design Spec

**Date:** 2026-03-26
**Goal:** Reduce interpretation drift in downstream AI tools by adding priority signaling, implementation precision, and clearer authority to the 4 export files.
**Scope:** Changes to `src/lib/export-formatters.ts` only. No schema changes, no UI changes, no new extraction fields.

## Problem

The exported files contain strong aesthetic direction but weak implementation contracts. Downstream AI tools (tested with Codex) silently substitute stacks, skip font loading, infer image scope, and treat requirements as suggestions. The files mix hard rules, recommendations, and inspiration without signaling which is which.

## Principles

1. **Compliance vs. creativity applies to different things.** Tokens, stack, fonts, image usage = follow exactly. Layout choreography, section flow, micro-interactions = creative latitude.
2. **File hierarchy is the priority order.** README > composition > style > assets. If files conflict, higher-ranked file wins.
3. **No new schema fields.** Non-negotiables and decision sheet are derived from existing DNA fields by the formatter, restated more firmly.
4. **No new UI inputs.** Everything is generated from what we already extract.

## File-by-File Changes

### README.md — Priority: EXACT

**Preamble (new):**
```
> Priority: EXACT — This file defines the project contract. Other files (style.md, composition.md, assets.md) support it. If files conflict, this one wins.
```

**Decision Sheet (new section, after Project Instructions):**
Auto-generated from existing DNA fields:
- **Stack:** "Required. Use [library] with [preset]. Do not substitute without justifying first."
  - Derived from `dna.theme_recommendation`
- **Content:** "Use real [subject] data where the subject is identifiable. If the subject is unfamiliar, research it before building. Use real facts, real imagery, and real content where possible. The design direction in these files assumes authentic content — placeholder copy will weaken the result. Use styled placeholder only for generic/unknown subjects."
  - Derived from `dna.project_instructions.project_summary` — if it names a real entity (band, brand, product), instruct real content + research. Otherwise, placeholder is acceptable.
- **Images:** "Reference images are provided in assets.md. Images marked as `usable_asset` may appear directly in the final build. Images marked as `style_reference` are for informing the design direction only — do not embed them literally. For images beyond the provided assets, source from open-source image libraries (Unsplash, Pexels, etc.). Use real photography that matches the project's visual direction — do not use AI-generated placeholder images."
  - Static text, always included when assets exist.

**Non-Negotiables (new section, after Decision Sheet):**
Derived from existing fields, restated as hard rules:
- From `dna.theme_recommendation`: "Must use [library] [preset]"
- From `dna.anti_patterns` (top 2-3 strongest): restate as "Must [this_is]" / "Must not [not_that]"
- From `dna.image_treatment`: restate treatment rules as requirements (e.g., "Must keep [treatment] photo style")

**Recommended Stack → Required Stack:**
- Heading changes from "## Recommended Stack" to "## Required Stack"
- Footer changes from "This is a recommended starting point..." to "Use this stack. If you have a strong reason to deviate, justify the alternative before building — do not silently substitute."

### style.md — Priority: EXACT

**Preamble (new):**
```
> Priority: EXACT — These are implementation tokens. Apply them exactly as specified. Do not approximate or substitute.
```

**Typography — Google Fonts loading (new):**
After the CSS block, add:
```
Load both fonts from Google Fonts:
@import url('https://fonts.googleapis.com/css2?family=[Display+Family]:wght@[weight]&family=[Body+Family]:wght@[weight]&display=swap');
```
- URL generated from `dna.typography.display.family`, `dna.typography.display.weight`, `dna.typography.body.family`, `dna.typography.body.weight`
- Spaces in font names replaced with `+`
- Add fallback classification line: "If the font fails to load, the fallback must preserve the classification (e.g., substitute another [classification], not a generic sans-serif)."

**No other changes to style.md.** Color, spatial, texture sections are already well-structured.

### composition.md — Priority: DIRECTIONAL

**Preamble (new):**
```
> Priority: DIRECTIONAL — This is creative direction. Use your judgment within these boundaries. Layout decisions, section transitions, and motion choreography are yours to determine — but stay within the described feel.
```

**Structural clarity (enhancement to Layout section):**
The existing `composition_layout` fields already cover archetype, structure, spatial_rules, and responsive_notes. The formatter should add a clarifying line after the layout block:

```
Sections may be full-width, boxed, overlapping, or nested — choose what fits the archetype above. Maintain visual consistency in navigation and typography across sections, but allow deliberate variation in background treatment, density, and composition between sections.
```

This is static guidance text, not derived from a new field.

**No other changes to composition.md.** Creative direction, motion, and image treatment sections are already strong.

### assets.md — Priority: EXACT

**Preamble (new):**
```
> Priority: EXACT — These are required reference assets. Incorporate them into the build as specified. Do not generate placeholder images when these references are provided.
```

**Image scope (enhancement to per-image block):**
Each image currently shows Role and Usage. Add a **Scope** line:
- `global` — if the image's `description` (from `image_roles`) references the overall site/project direction, hero, or framing
- `section` — if it references a specific section or component

Determination logic in the formatter:
- If `description` contains words like "hero", "overall", "site-wide", "framing", "global", "whole" → `global`
- Otherwise → `section`

Updated per-image block:
```
### asset-1.jpg
**Role:** Style reference
**Scope:** Global — influences overall site framing
**Usage:** [description from image_roles]
![description](asset-1.jpg)
```

**Stronger incorporation instruction:**
Change "Use them as directed." to "You MUST incorporate these references into the final build. For global-scope images, let them influence the overall site framing and design language. For section-scope images, apply them to the specific sections noted in their usage description."

## Section Mapping (current → new)

| Section | Current | New |
|---------|---------|-----|
| README preamble | none | Priority: EXACT + hierarchy note |
| Decision Sheet | none | new section from existing fields |
| Non-Negotiables | none | new section derived from anti_patterns + theme_rec + image_treatment |
| Recommended Stack | "recommended starting point" | "Required Stack" + "justify before deviating" |
| style.md preamble | none | Priority: EXACT |
| Typography fonts | CSS variables only | + Google Fonts @import URL + fallback classification |
| composition.md preamble | none | Priority: DIRECTIONAL |
| Layout section | existing fields | + structural clarity guidance line |
| assets.md preamble | "Use them as directed" | Priority: EXACT + must incorporate |
| Per-image block | Role + Usage | + Scope (global/section) |

## What Stays the Same

- All DNA schema types (`src/types/dna.ts`) — no changes
- Extraction prompts (`src/app/api/extract-dna/prompts.ts`) — no changes
- `formatForMidjourney`, `formatImageGenSkill` — no changes
- `formatForCodeTools` wrapper — no changes
- `downloadPackage` — no changes
- ExportView UI — no changes
- Image classification logic — no changes

## Implementation Notes

- All changes are in `export-formatters.ts` functions: `formatReadme`, `formatStyle`, `formatComposition`, `formatAssets`
- Google Fonts URL generation: replace spaces with `+`, construct URL from family + weight
- Scope detection: simple keyword match on `image_roles[].description`
- Non-negotiables: formatter reads `anti_patterns[0..2]`, `theme_recommendation`, and `image_treatment.treatment` and restates them as imperative rules
- Decision sheet: formatter reads `theme_recommendation` and `project_instructions.project_summary` to determine stack and content rules
