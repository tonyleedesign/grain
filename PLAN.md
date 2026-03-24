# Two-Pass DNA Extraction: Implementation Plan

## Summary

Refactor the DNA extraction pipeline from a single API call (images + schema → JSON) to a two-pass "think-then-synthesize" approach inspired by Luma's Uni-1 reasoning model. Pass 1 forces genuine visual observation without any schema, categories, or normalization. Pass 2 synthesizes observations into structured DNA with the user's subjective lens applied. Alongside this, clean up hardcoded anti-slop, font bans, and export formatting.

## Why

The current single-pass approach lets the model see the JSON schema while looking at images, which causes:
- Template-filling instead of genuine reasoning (Bebas Neue + DM Sans on every board)
- Archetype pattern-matching ("dark images → nocturnal moody aesthetic")
- Abstract poetry instead of grounded observation ("Poison green bleeds crimson")

Two-pass forces the model to describe what it actually sees BEFORE it knows what fields to fill.

---

## Architecture

```
Current:  Images + Schema → Claude → JSON
New:      Images + factual context → Claude (Pass 1) → Observations
          Observations + user intent + Schema → Claude (Pass 2) → JSON + Reasoning
```

**Pass 1 — Observe (uncontaminated):**
- Sends: images + source context only (factual recognition aid)
- Does NOT send: JSON schema, axis definitions, field names, use case, appeal context
- Uses: extended thinking (budget_tokens: 8000) as a multiplier, not the main fix
- Returns: unstructured natural language observations (per-image + cross-image)
- Critical: NO categories, NO hex values, NO font names, NO design jargon normalization

**Pass 2 — Synthesize (with user intent):**
- Sends: observations text + use case + appeal context + JSON schema + axes + quality gates + consistency check
- Does NOT send: images (works only from Pass 1 observations)
- No extended thinking needed (synthesis, not visual analysis)
- Returns: DNA JSON with new `reasoning` field
- Use case and appeal context applied HERE to steer direction, not contaminate observation

---

## Key Design Decisions

### Why appeal context lives in Pass 2, not Pass 1

If the user says "I love the moody urban atmosphere," Pass 1 would start seeing "moody urban atmosphere" everywhere, even when the images are more mixed. Appeal context is about *what to amplify* — that's a synthesis decision. Pass 1 should observe without a subjective lens.

Source context stays in Pass 1 because it's factual ("these are from Wong Kar-wai films") — it helps the model recognize what it's looking at, not bias what it emphasizes.

### Why use case lives in Pass 2, not Pass 1

Use case ("fashion website") tells the model what the images are *for*, which changes what it *sees*. A use case of "fashion website" causes the model to overread editorial layouts and luxury aesthetics into images that might just be moody street photography. The model contextualizes instead of observes.

Pass 1 should see what's actually in the images. Pass 2 should decide what to do with those observations for this specific project. Use case is directional intent, not factual context — same category as appeal context.

Pass 1 receives ONLY images + source context. Everything else is synthesis-stage input.

### Why Pass 1 has no categories

An earlier version of this plan asked Pass 1 to organize observations into COLORS, TEXTURE, LIGHT, TYPOGRAPHY, etc. This is still halfway to a schema — the model can shortcut by deciding "this is brutalist" and then writing observations that support that archetype under each heading.

Instead, Pass 1 asks: "describe what you see, as if explaining to someone who can't see the image." No buckets. Let the model decide what's notable. If the most striking thing about an image is the motion blur on a motorcycle rider, it should lead with that — not force it into a COMPOSITION slot.

### Why no hex values or font names in Pass 1

Hex estimation is synthesis, not observation. "Warm amber tone covering most of the background" is observation. "#D4A574" is normalization. Same for fonts — "thick, wide, squared-off letterforms" is observation. "Bebas Neue" is pattern-matching from memory. All normalization happens in Pass 2 when the schema is present.

### Extended thinking is a multiplier, not the fix

The real gain comes from changing the task structure (two passes, no schema in observation). Extended thinking may improve depth of observation but a badly designed prompt with more thinking tokens still produces more elaborate nonsense. We use it but don't depend on it.

---

## Step-by-Step Implementation

### Step 1: Update Types (`src/types/dna.ts`)

Add reasoning interface, make it optional on both DNA types for backward compat:

```typescript
export interface DNAReasoning {
  // --- Observation layer (what was seen) ---
  per_image: string[]        // What was seen in each image — literal, not interpreted
  repeated_signals: string   // What visual patterns appeared across multiple images
  tensions: string           // Where images disagreed or pulled in different directions

  // --- Conclusion layer (what was decided) ---
  synthesis: string          // How tensions were resolved, what was amplified/deprioritized
  archetype_check: string    // Nearest archetype + specifically how THIS collection differs
}

// Add to WebAppDNA:
reasoning?: DNAReasoning

// Add to ImageGenDNA:
reasoning?: DNAReasoning
```

The shape encodes the product truth: **observation → conclusion**. The panel can visually separate "What the AI saw" from "What the AI decided," giving users a trust layer — they can check whether the conclusions follow from the observations.

No changes to `PatternEvidence` — it stays as-is for now. The reasoning field supplements it; we can revisit merging them later when designing the panel UX.

### Step 2: Rewrite Prompts (`src/app/api/extract-dna/prompts.ts`)

This is the biggest change. The file gets restructured into three sections:

**A. New observation prompts (Pass 1):**

```typescript
// System prompt for Pass 1 — medium-agnostic, no schema awareness
export const OBSERVE_SYSTEM = `You are a visual analyst...`

// User prompt builder for Pass 1 — ONLY images + source context
export function buildObservePrompt(
  imageCount: number,
  medium: Medium,
  sourceContext?: string
): string
```

The observation prompt is deliberately unstructured. It does NOT use category headings. Instead it asks:

**Per image:**
"Describe what you literally see in this image as if explaining to someone who can't see it. What colors dominate and where? What do the surfaces feel like? How is light behaving? What is the subject doing? How is the frame organized? What mood does it create and what specific visual elements create that mood?"

**Cross-image:**
- What visual patterns REPEAT across these images? (These are the signal.)
- Where do images DISAGREE or pull in different directions? (These are the tensions.)
- What is the ONE thing that makes this collection unmistakable — the quality that, if removed, would make it generic?
- What would RUIN this aesthetic if introduced?

**Contrastive examples in the prompt (teach by showing the boundary):**

Rather than a list of "DO NOT" rules, the observation prompt includes 1-2 contrastive pairs that show interpretation vs observation:

```
Example — interpretation vs observation:

INTERPRETATION (wrong): "This has a brutalist aesthetic with muted earth tones
and strong geometric composition."

OBSERVATION (right): "Heavy black borders around every element, no rounded corners
anywhere. Background is a flat warm gray that covers about 70% of the frame.
White text at very large scale — the letters are monospaced, tightly tracked,
and take up nearly a third of the image height. One orange accent line runs
horizontally across the lower third."
```

This teaches the model what "describe, don't classify" actually means without activating bad patterns through negative rules.

**B. New synthesis prompts (Pass 2):**

```typescript
// System prompts for Pass 2 — receives observations, not images
export const WEB_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer...`
export const IMAGE_GEN_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer...`

// User prompt builders for Pass 2 — NOW gets appeal context
export function buildWebAppSynthesizePrompt(
  observations: string,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string
): string

export function buildImageGenSynthesizePrompt(
  observations: string,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string
): string
```

Pass 2 system prompts include:
- Anti-archetype warning ("you did NOT see the images — work only from observations")
- Axis definitions (WEB_AXES / IMAGE_GEN_AXES) — moved here from current system prompts
- Quality gates (modified — see below)
- Consistency check (unchanged)

Pass 2 user prompts include:
- The observations text injected as a block
- Appeal context (if provided) — injected as a weighting signal: "The user said what draws them to these images: '...'. Use this to decide which observations to AMPLIFY — it is the priority signal for resolving ambiguity between competing observations."
- The JSON schema (same as current, plus new `reasoning` field at top)
- Rules (same as current)
- Commitment instructions

**C. Modified shared blocks:**

- `QUALITY_GATES`: Remove font ban line ("NEVER default to Inter, Roboto..."). Replace with font vocabulary guidance:
  ```
  Typography: Do not guess font names from memory defaults. Match the letterform
  characteristics described in the observations (weight, width, contrast, terminals)
  to a Google Font with those specific characteristics. Use classification to
  narrow: geometric-sans, humanist-sans, neo-grotesque, transitional-serif, didone,
  slab, display, mono. If the observations don't describe visible typography,
  choose fonts that match the overall mood and axis commitments.
  ```

- `QUALITY_GATES`: Direction summary gate already updated ("needs contrast and positioning")

- Add `ANTI_ARCHETYPE` constant injected into Pass 2 system prompts:
  ```
  If you find yourself thinking "this looks like a brutalist/minimalist/editorial design,"
  STOP. Name that archetype in your reasoning.archetype_check, then identify what makes
  THESE specific observations different from that archetype template. Your output must
  capture those differences. The archetype is a starting point for differentiation,
  not a template to fill in.
  ```

- Keep `COMMITMENT_INSTRUCTIONS`, `CONSISTENCY_CHECK`, axis definitions — all move to Pass 2 only

**D. Deprecate old exports:**

Mark `WEB_APP_SYSTEM`, `IMAGE_GEN_SYSTEM`, `buildWebAppPrompt`, `buildImageGenPrompt` with `@deprecated` comments but keep them for rollback safety. They are no longer imported in route.ts.

### Step 3: Refactor Route (`src/app/api/extract-dna/route.ts`)

Split into two internal functions + main handler:

```typescript
// Pass 1: Observe images — uncontaminated, no schema, no use case, no appeal context
async function runObservation(
  imageUrls: string[],
  medium: Medium,
  sourceContext?: string
): Promise<string> {
  // Uses extended thinking: { type: 'enabled', budget_tokens: 8000 }
  // Returns observations text
}

// Pass 2: Synthesize DNA from observations — applies user intent
async function runSynthesis(
  observations: string,
  medium: Medium,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string,
  feedback?: string,
  previousDna?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // max_tokens: 6144 (increased from 4096 for reasoning field)
  // No extended thinking, no images
  // Returns parsed DNA JSON
}

export async function POST(request: NextRequest) {
  // Parse body — now includes optional `observations` and `appealContext`
  // If body.observations exists → skip Pass 1 (regeneration path)
  // Otherwise → run Pass 1
  // Run Pass 2 with observations + appeal context
  // Upsert to Supabase (now includes observations column)
  // Return { medium, dna, observations }
}
```

Request body additions:
- `appealContext?: string` — new field from MediumPicker, passed to Pass 2
- `observations?: string` — provided on regeneration to skip Pass 1

Response body change:
- Now returns `{ medium, dna, observations }` (was `{ medium, dna }`)

Import changes:
- Import new prompt functions instead of old ones
- Update Anthropic SDK usage for extended thinking

### Step 4: Add Appeal Context to MediumPicker (`src/components/dna/MediumPicker.tsx`)

Add new textarea field between source context and the Extract button:

- **Label:** "What draws you to these?"
- **Helper text:** "Tell us what you like — the mood, colors, texture, composition, feeling. Helps the AI focus on what matters to you."
- **Placeholder:** "e.g. the motion blur and neon glow, the moody urban atmosphere, the cinematic framing"
- Optional field, same styling as existing inputs

Update `onSubmit` signature:
```typescript
onSubmit: (medium: Medium, useCase: string, sourceContext?: string, appealContext?: string) => void
```

### Step 5: Wire Appeal Context and Observations in DNAPanelV2 (`src/components/dna/DNAPanelV2.tsx`)

- Add `appealContext` state, pass through `extractDNA` and `handleRegenerate`
- Add `observations` state, populated from extraction response
- On regeneration, pass `observations` back to skip Pass 1
- On board load from Supabase, populate observations from stored data
- Update loading message: "Analyzing images and synthesizing DNA... This usually takes 20-30 seconds."
- Pass `dna.reasoning` through to DesignerView (it's already in the dna object)

### Step 6: Clean Up Export Formatter (`src/lib/export-formatters.ts`)

1. **Delete** `WEB_ANTI_SLOP` constant and its `sections.push()` call
2. **Delete** `IMAGE_GEN_ANTI_SLOP` constant and its `sections.push()` call
3. **Remove** the "Ask yourself" template line (line ~73: `Ask yourself before every component...`)
4. **Simplify** overlay CSS variable names — use index-based: `--overlay-1`, `--overlay-2` instead of slugified descriptions

### Step 7: Create ReasoningField Component (`src/components/dna/fields/ReasoningField.tsx`)

New component for displaying AI reasoning in the designer panel:

- Collapsed by default, expandable
- Two visual sections reflecting the observation → conclusion split:
  - **"What the AI saw"** — per-image observations (numbered list), repeated signals, tensions
  - **"What the AI decided"** — synthesis rationale, archetype check
- Users can verify: do the conclusions follow from the observations?
- Uses existing panel styling conventions (var(--color-*), text sizes)
- Only renders when `dna.reasoning` exists (backward compat)

### Step 8: Add ReasoningField to Designer Views

- `src/components/dna/layouts/WebAppDesignerView.tsx` — Add `<ReasoningField>` at top, before direction summary
- `src/components/dna/layouts/ImageGenDesignerView.tsx` — Same

### Step 9: Supabase Schema Update

Add `observations` column to `boards` table:
```sql
ALTER TABLE boards ADD COLUMN IF NOT EXISTS observations text;
```

Update both the insert and update paths in route.ts to include `observations`.

Update the board GET endpoint to return `observations` in the response (for loading on page refresh).

---

## Regeneration Strategy

- **Default regeneration** (user provides feedback): Reuse Pass 1 observations, only re-run Pass 2. The images haven't changed — the observations are still valid. Feedback targets synthesis decisions, not visual analysis. This cuts regeneration time roughly in half.

- **Future: "Re-observe" action**: For when the user changes images in the board. Explicitly re-runs Pass 1. Not implemented in this phase — can be added as a secondary action later.

---

## File Change Summary

| File | Type | What Changes |
|------|------|-------------|
| `src/types/dna.ts` | Modify | Add `DNAReasoning` interface, optional `reasoning` on both DNA types |
| `src/app/api/extract-dna/prompts.ts` | Major rewrite | New observe/synthesize prompts, font vocabulary, anti-archetype. Deprecate old exports |
| `src/app/api/extract-dna/route.ts` | Major rewrite | Two-pass orchestration, extended thinking, observations in request/response/Supabase |
| `src/components/dna/MediumPicker.tsx` | Modify | Add appeal context field |
| `src/components/dna/DNAPanelV2.tsx` | Modify | Wire appeal context, observations state, updated loading UX |
| `src/lib/export-formatters.ts` | Modify | Remove anti-slop constants, "Ask yourself" line, simplify overlay names |
| `src/components/dna/fields/ReasoningField.tsx` | New file | Collapsible reasoning display component |
| `src/components/dna/layouts/WebAppDesignerView.tsx` | Modify | Add ReasoningField at top |
| `src/components/dna/layouts/ImageGenDesignerView.tsx` | Modify | Add ReasoningField at top |
| `src/app/api/boards/route.ts` | Modify | Return `observations` in GET response |
| Supabase | Migration | `ALTER TABLE boards ADD COLUMN observations text` |

---

## Implementation Order

1. Types (foundation, no deps)
2. Supabase migration (add column before code references it)
3. Prompts (new functions, keep old for rollback)
4. Route (two-pass logic, wire new prompts)
5. Export formatter (independent cleanup)
6. MediumPicker (appeal context field)
7. DNAPanelV2 (wire observations + appeal context)
8. ReasoningField component (new UI)
9. Designer views (wire reasoning into views)
10. Boards API (return observations on GET)
11. End-to-end test

---

## Edge Cases

- **Pass 1 empty/malformed:** Check observations length before Pass 2. Return clear error.
- **Pass 1 quality is the bottleneck:** Pass 2 cannot recover from missed observations since it has no images. This makes the observation prompt the most critical piece — iterate on it based on real output.
- **Extended thinking API rejection:** Catch error, retry without thinking as fallback.
- **Backward compat:** Existing boards have `observations: null` and no `reasoning` in DNA. The `?` on typing handles this. Panel checks before rendering.
- **Regeneration after refresh:** Client loses `observations` state, but board GET returns it from Supabase.
- **Pass 2 JSON parse failure:** Existing regex cleanup handles it. No change needed.

## Not In Scope (Future)

- Streaming Pass 1 to client for live "AI thinking" visibility
- Image tagging on canvas ("main inspo", "color reference")
- Image annotations
- Re-observe action for when board images change
- Merging evidence and reasoning into a unified panel section
