// Two-pass DNA extraction prompts.
// Pass 1 (Observe): images + source context ONLY — no schema, no categories, no normalization.
// Pass 2 (Synthesize): observations + user intent + schema — no images.
//
// Architecture rationale: see PLAN.md and memory/project_two_pass_extraction.md

// ─── Shared building blocks (Pass 2 only) ───

const SHARED_AXES = `- Warm ↔ Cool
- Organic ↔ Geometric
- Dense ↔ Spacious
- Polished ↔ Raw`

const WEB_AXES = `Before synthesizing, evaluate the observations along these axes and COMMIT to a position:
${SHARED_AXES}
- Editorial ↔ Systematic
- Image-Led ↔ Interface-Led
- Saturated ↔ Muted

Pick ONE side of each axis. Do not hedge. Your entire extraction must be internally consistent with these positions. If observations pull in multiple directions, choose the DOMINANT signal — do not average.`

const IMAGE_GEN_AXES = `Before synthesizing, evaluate the observations along these axes and COMMIT to a position:
${SHARED_AXES}
- Sharp ↔ Soft
- Hard Light ↔ Diffused
- Contemporary ↔ Nostalgic

Pick ONE side of each axis. Do not hedge. Your entire extraction must be internally consistent with these positions. If observations pull in multiple directions, choose the DOMINANT signal — do not average.`

const QUALITY_GATES = `Quality gates — every output must pass these:
- Anti-patterns must be CONCRETE visual boundaries. Good: "bold geometric type" vs "playful script fonts". Bad: "good design" vs "bad design".
- Direction summary needs contrast and positioning. Good: "Restrained editorial warmth — not corporate, not playful." Bad: "Modern and clean design."
- Colors must have a clear dominant/accent hierarchy. 5 equally weighted colors = failure.
- Typography: match the letterform characteristics described in the observations (weight, width, contrast, terminals) to a Google Font with those specific characteristics. Use classification to narrow: geometric-sans, humanist-sans, neo-grotesque, transitional-serif, didone, slab, display, mono. If the observations don't describe visible typography, choose fonts that match the overall mood and axis commitments.
- Texture must identify a PRIMARY source of character. Do not default to blur, frosted glass, grain overlays, or atmospheric haze as generic shorthand for mood.
- Mood tags must be evocative and specific. Good: "visceral", "weathered", "nocturnal". Bad: "modern", "clean", "professional".
- If any field could apply to 100 different projects, rewrite it until it could only apply to THIS one.`

const CONSISTENCY_CHECK = `INTERNAL CONSISTENCY CHECK — your axis commitments dictate EVERY field. Before outputting, verify all relationships:

Warm ↔ Cool governs:
- Colors: warm hues (amber, terracotta, cream) vs cool hues (slate, ice blue, silver). A "warm" commit with a cold blue palette = failure.
- Typography: humanist/serif fonts feel warm; geometric/mono fonts feel cool. Match the axis.
- Texture: organic textures (grain, paper, linen) feel warm; clean/synthetic surfaces feel cool.

Polished ↔ Raw governs:
- Border radius: high radius (16+) = polished/friendly; 0px = raw/brutalist. "Raw" commit with 24px rounded corners = failure.
- Shadows: layered/elevated = polished depth; none = raw/flat. Match the axis.
- Texture finish: glossy/frosted = polished; raw/matte = unpolished. A "polished" commit with "raw" finish = contradiction.
- Light behavior: reflective = polished; absorptive = raw. Shadow crush: none = polished clarity; heavy = raw/dramatic.
- Typography weight: lighter weights feel refined; heavier weights feel raw/bold.
- Motion: subtle/css-only = polished restraint; static = raw/print-like; immersive = depends on execution.

Dense ↔ Spacious governs:
- Spacing density: compact = dense; spacious = airy. Direct mapping — no exceptions.
- Image placement: contained-in-cards = dense; full-bleed = spacious. Match the axis.
- Typography scale: dense designs use tighter type hierarchies; spacious designs use dramatic size contrasts.

Organic ↔ Geometric governs:
- Border radius: varied per element = organic; uniform across all = geometric.
- Typography classification: humanist-sans/serif = organic; geometric-sans/mono = geometric.
- Texture: irregular patterns (noise, grain) = organic; clean gradients/grids = geometric.

Saturated ↔ Muted governs:
- Color saturation: vivid full-saturation palette vs desaturated/tonal palette. This must be visible in your hex values.
- Image treatment: high-contrast/color-graded = saturated; desaturated/tonal restraint = muted. Muted does NOT automatically mean blurry.

Image-Led ↔ Interface-Led governs:
- IMPORTANT: do NOT confuse "reference images contain photos" with "the design is image-led." A portfolio site showing work in a grid of cards is INTERFACE-LED — the images are content, not design. Image-led means images drive the LAYOUT: full-bleed heroes, photography as background, images breaking the grid. Ask: "does the layout serve the images, or do images sit inside the layout?" If images are contained in cards/grids, that's interface-led.
- Also consider the use case: dashboards, tools, and SaaS are almost always interface-led. Editorial, fashion, and photography sites lean image-led. Let the use case inform this axis.
- Image treatment role: hero-driven = image-led; supporting/decorative/minimal = interface-led.
- Typography: image-led designs can use simpler type (images do the talking); interface-led designs need stronger, more distinctive typography.
- Motion: image-led sites often use parallax/scroll reveals on images; interface-led sites use functional transitions.

Cross-check: read your color hex values, mood tags, typography, border radius, texture, and motion together. They must all tell the SAME story. If any field feels like it belongs to a different project, fix it.`

const ANTI_ARCHETYPE = `If you find yourself thinking "this looks like a brutalist/minimalist/editorial design," STOP. Name that archetype in your reasoning.archetype_check, then identify what makes THESE specific observations different from that archetype template. Your output must capture those differences. The archetype is a starting point for differentiation, not a template to fill in.`

const COMMITMENT_INSTRUCTIONS = `
Before generating your JSON, internally commit:
1. Which axis positions describe these observations? (pick sides, don't hedge)
2. What is the ONE thing that makes this aesthetic unmistakable?
3. What would RUIN this aesthetic if added?

Your anti-patterns should answer #3. Your direction_summary should answer #2. Every other field must be consistent with #1.`

// ═══════════════════════════════════════════════════════════
// PASS 1 — OBSERVE (uncontaminated, no schema, no use case)
// ═══════════════════════════════════════════════════════════

export const OBSERVE_SYSTEM = `You are a visual analyst. Your job is to describe what you literally see in images — not to classify, categorize, or interpret them into design systems.

You do not know what these images will be used for. You have no schema to fill. You have no categories to sort into. You are simply describing visual reality to someone who cannot see the images.

Example — interpretation vs observation:

INTERPRETATION (wrong): "This has a brutalist aesthetic with muted earth tones and strong geometric composition."

OBSERVATION (right): "Heavy black borders around every element, no rounded corners anywhere. Background is a flat warm gray that covers about 70% of the frame. White text at very large scale — the letters are monospaced, tightly tracked, and take up nearly a third of the image height. One orange accent line runs horizontally across the lower third."

The first tells someone what to think. The second lets them see.

Rules:
- Describe colors by appearance and position, not hex values. "Warm amber covering most of the background" not "#D4A574".
- Describe letterforms by shape, not font names. "Thick, wide, squared-off letterforms with no visible stroke contrast" not "Bebas Neue".
- Describe textures by feel, not category. "Visible grain across the entire surface, like film stock" not "raw texture".
- If you can't tell what something is, say so. "Blurred shape in the lower right, possibly a hand" not "artistic motion blur effect".
- Lead with what's most striking. If the most notable thing is motion blur on a motorcycle, lead with that.`

export function buildObservePrompt(
  imageCount: number,
  sourceContext?: string
): string {
  const sourceBlock = sourceContext
    ? `\nReference context: "${sourceContext}". Use this to help recognize what you're looking at — but describe what you SEE, not what you know about the source.\n`
    : ''

  return `You are looking at ${imageCount} image${imageCount !== 1 ? 's' : ''} that someone has collected together.
${sourceBlock}
For each image, describe what a careful viewer would notice first. Lead with what is visually dominant or unusual. Do not force complete coverage — only mention details that materially shape the image. If something is uncertain, say it is uncertain.

After describing what is most immediately striking, notice any secondary details that materially shape the image: surface quality, edge treatment, spatial tension, lighting behavior, or the relationship between type and image. Only mention them if they are actually present and visually important.

After describing each image, describe what repeats across the set, what conflicts, what single quality makes the collection unmistakable, and what would make it feel generic if introduced.

Write naturally. No bullet points, no headers, no structure.`
}

// ═══════════════════════════════════════════════════════════
// PASS 2 — SYNTHESIZE (from observations, with user intent)
// ═══════════════════════════════════════════════════════════

export const WEB_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer. You are working from written observations of images — you did NOT see the images yourself. Your job is to translate visual observations into a structured design system for web/app interfaces.

${ANTI_ARCHETYPE}

Web design is not just UI components — it includes how imagery lives in the layout. A hero-driven editorial site with full-bleed photography is fundamentally different from a dashboard with small thumbnails. Capture this distinction.

${WEB_AXES}

${QUALITY_GATES}

${CONSISTENCY_CHECK}`

export const IMAGE_GEN_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer. You are working from written observations of images — you did NOT see the images yourself. Your job is to translate visual observations into structured parameters for AI image generation.

${ANTI_ARCHETYPE}

Use professional photography and art direction vocabulary. Every value must be grounded in the observations. No vague adjectives. No hedging.

${IMAGE_GEN_AXES}

${QUALITY_GATES}`

export function buildWebAppSynthesizePrompt(
  observations: string,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string,
  feedback?: string,
  previousDna?: Record<string, unknown>,
  fontShortlist?: string
): string {
  const useCaseBlock = useCase
    ? `\nThe user is building: "${useCase}"
This is critical context — it should actively shape your synthesis:
- Typography should match what works for this type of project
- Color roles should be assigned for this use case
- Anti-patterns should reject what would be wrong for THIS specific project
- Image treatment should reflect how imagery would actually be used in this type of project
- Direction summary should position the design relative to others in this category\n`
    : ''

  const sourceBlock = sourceContext
    ? `\nReference context: "${sourceContext}" — use this to inform era, movement, and technique references.\n`
    : ''

  const appealBlock = appealContext
    ? `\nThe user said what draws them to these images: "${appealContext}"
Use this as the PRIORITY signal for resolving ambiguity. When observations pull in multiple directions, amplify what the user said they're drawn to. This is their subjective lens — it tells you which observations matter most.\n`
    : ''

  let feedbackBlock = ''
  if (feedback) {
    feedbackBlock = `\n\nIMPORTANT — the user rejected the previous extraction with this feedback: "${feedback}"
This feedback takes PRIORITY. Change what the user asked you to change — do not repeat or slightly adjust the previous values.`
    if (previousDna) {
      feedbackBlock += `\n\nHere is the REJECTED extraction — do NOT repeat these values:\n${JSON.stringify(previousDna, null, 2)}`
    }
  }

  return `Here are the visual observations from ${imageCount} images:

---
${observations}
---
${useCaseBlock}${sourceBlock}${appealBlock}${feedbackBlock}

Synthesize these observations into a Design DNA for web/app design.

Return a JSON object with this exact structure:
{
  "reasoning": {
    "per_image": ["One sentence per image — what was most distinctive about it, in your own words from the observations"],
    "repeated_signals": "What visual patterns were consistent across observations",
    "tensions": "Where observations disagreed or pulled in different directions",
    "synthesis": "How you resolved tensions — what you amplified, what you deprioritized, and why",
    "archetype_check": "The nearest design archetype + specifically how THIS collection differs from that template"
  },
  "board_name": "2-4 words, distinctive",
  "color_palette": {
    "colors": [
      { "hex": "#hex", "role": "primary|secondary|accent|dark|light" }
    ],
    "overlays": [
      { "rgba": "rgba(r, g, b, alpha)", "use": "what this transparent layer does" }
    ],
    "relationship": "4 words max describing how colors relate"
  },
  "typography": {
    "display": { "family": "Google Font name", "weight": 400, "classification": "geometric-sans|humanist-sans|neo-grotesque|transitional-serif|didone|slab|display|mono" },
    "body": { "family": "Google Font name", "weight": 400, "classification": "same options" }
  },
  "border_radius": 8,
  "spacing_density": "compact|comfortable|spacious",
  "shadow_style": "none|subtle|layered|elevated",
  "texture": {
    "background": ["2-4 keywords"],
    "finish": "matte|glossy|frosted|raw",
    "light_behavior": "absorptive|reflective|mixed",
    "shadow_crush": "none|moderate|heavy"
  },
  "motion": {
    "level": "static|subtle|expressive|immersive",
    "techniques": ["2-4 keywords"],
    "approach": "css-only|framer-motion|gsap|webgl/three.js"
  },
  "image_treatment": {
    "role": "hero-driven|supporting|decorative|minimal",
    "treatment": ["2-4 keywords"],
    "placement": ["2-4 keywords"],
    "text_overlay": "dark-scrim|gradient-fade|clear-space|knockout|none"
  },
  "project_instructions": {
    "project_summary": "Clean 1-sentence project description",
    "sections": ["4-6 key pages/sections"],
    "content_tone": ["3-4 writing style directives"],
    "standout_tips": ["2-3 tips specific to this project type"]
  },
  "anti_patterns": [
    { "this_is": "2-6 words", "not_that": "2-6 words" }
  ],
  "mood_tags": ["single", "words", "only"],
  "direction_summary": "Max 15 words. Format: [What it is] — not [what it's not]",
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "center|top-left|background|etc", "conflict": "optional" }
  ]
}

Rules:
- The reasoning field comes FIRST. It is a trace of what was observed and how those observations were resolved into one direction. Every field that follows is a BINDING consequence of the reasoning — if your reasoning says "outlined stroke-only type," your typography must be an outlined or ultra-thin font, not a filled sans-serif. If your anti-patterns reject something, no other field may reintroduce it. Read your reasoning back before generating each field and verify it follows.
- Exactly 5 colors with semantic roles. These must be SOLID, INTENTIONAL design colors — derived from what the observations describe, not ambient lighting.
- overlays: 2-4 transparent layers as rgba values for scrims, tints, color grades.
- Typography: choose from the FONT CANDIDATES list below. Pick the font whose classification and expressive traits best match the observations and your axis commitments. If no letterforms were described in observations, choose fonts that match the overall mood. Do NOT pick fonts outside this list.
- border_radius: single number 0-24. 0=brutalist, 4-6=sharp professional, 8-12=balanced, 16+=friendly rounded
- texture: derive from surface descriptions in the observations. Name the main texture strategy, not a pile of atmospheric effects. Do not default to blur, frosted glass, grain overlays, or haze unless the observations explicitly support them.
- motion: infer from the design style and energy level described. Motion level must match approach: static/subtle = css-only or framer-motion, expressive = gsap, immersive = webgl/three.js. Do not pair subtle motion with gsap.
- project_instructions: if observations describe layout patterns, use them. Otherwise recommend for the project type.
- Exactly 3 anti_patterns with concrete visual boundaries. Anti-patterns must describe reusable visual direction, not the literal subject matter of a specific reference image. Prefer the design quality an image implies ("lifestyle softness", "friendly warmth", "polished luxury sheen") over the exact depicted pose, object, or scene, unless the medium is image generation and subject matter is structurally important.
- 3-5 mood_tags, single words only. Must be evocative.
- 3-5 evidence items grounding key patterns in specific images.
- direction_summary must synthesize anti-patterns into one positioning statement with contrast.
- REJECT: sentences longer than 6 words (except direction_summary), vague adjectives, metaphors.
${COMMITMENT_INSTRUCTIONS}
${fontShortlist ? `
FONT CANDIDATES — choose display and body fonts from this list ONLY:
${fontShortlist}
` : ''}
Return ONLY valid JSON, no markdown fences, no explanation.`
}

export function buildImageGenSynthesizePrompt(
  observations: string,
  imageCount: number,
  useCase?: string,
  sourceContext?: string,
  appealContext?: string,
  feedback?: string,
  previousDna?: Record<string, unknown>
): string {
  const useCaseBlock = useCase
    ? `\nThe user wants to generate: "${useCase}"
This should shape your synthesis — lighting, composition, and anti-patterns should be tailored to this purpose.\n`
    : ''

  const sourceBlock = sourceContext
    ? `\nReference context: "${sourceContext}" — use this to inform era, movement, and technique references.\n`
    : ''

  const appealBlock = appealContext
    ? `\nThe user said what draws them to these images: "${appealContext}"
Use this as the PRIORITY signal for resolving ambiguity. Amplify what the user said they're drawn to.\n`
    : ''

  let feedbackBlock = ''
  if (feedback) {
    feedbackBlock = `\n\nIMPORTANT — the user rejected the previous extraction with this feedback: "${feedback}"
This feedback takes PRIORITY. Change what the user asked you to change.`
    if (previousDna) {
      feedbackBlock += `\n\nHere is the REJECTED extraction — do NOT repeat these values:\n${JSON.stringify(previousDna, null, 2)}`
    }
  }

  return `Here are the visual observations from ${imageCount} images:

---
${observations}
---
${useCaseBlock}${sourceBlock}${appealBlock}${feedbackBlock}

Synthesize these observations into a Design DNA for image generation.

Return a JSON object with this exact structure:
{
  "reasoning": {
    "per_image": ["One sentence per image — what was most distinctive"],
    "repeated_signals": "What visual patterns were consistent",
    "tensions": "Where observations disagreed",
    "synthesis": "How you resolved tensions and why",
    "archetype_check": "Nearest archetype + how THIS collection differs"
  },
  "board_name": "2-4 words, distinctive",
  "color_palette": {
    "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "mood": "2-4 word mood description"
  },
  "medium_type": {
    "primary": "photography|illustration|3d|mixed",
    "sub_tags": ["technique tags"]
  },
  "lighting": ["professional lighting terms"],
  "texture": {
    "level": "clean|light|moderate|heavy",
    "keywords": ["texture descriptors"]
  },
  "composition": {
    "style": "archetype name",
    "description": "2-3 word description"
  },
  "era_movement": ["specific era or movement references"],
  "anti_patterns": [
    { "this_is": "2-6 words", "not_that": "2-6 words" }
  ],
  "mood_tags": ["single", "words", "only"],
  "direction_summary": "Max 15 words. Format: [What it is] — not [what it's not]",
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "position", "conflict": "optional" }
  ]
}

Rules:
- The reasoning field comes FIRST. It is a trace of what was observed and how those observations were resolved into one direction. Every field that follows is a BINDING consequence of the reasoning — if your reasoning says "outlined stroke-only type," your typography must be an outlined or ultra-thin font, not a filled sans-serif. If your anti-patterns reject something, no other field may reintroduce it. Read your reasoning back before generating each field and verify it follows.
- 5 hex colors that capture the dominant palette — derived from color descriptions in observations.
- medium_type.primary: choose ONE. sub_tags: 2-4 specific technique references.
- lighting: 2-4 professional terms. NO camera settings like f/1.4.
- texture.level: one of four enums. keywords: 2-4 specific texture words.
- Exactly 3 anti_patterns with concrete visual boundaries. Anti-patterns must describe reusable visual direction, not the literal subject matter of a specific reference image. Prefer the design quality an image implies ("lifestyle softness", "friendly warmth", "polished luxury sheen") over the exact depicted pose, object, or scene, unless the medium is image generation and subject matter is structurally important.
- 3-5 mood_tags, single words only. Must be evocative.
- 3-5 evidence items.
- direction_summary synthesizes anti-patterns into one positioning statement with contrast.
- REJECT: camera settings, sentences >6 words (except direction_summary), vague adjectives.
${COMMITMENT_INSTRUCTIONS}

Return ONLY valid JSON, no markdown fences, no explanation.`
}

// ─── Deprecated: old single-pass exports (kept for rollback) ───

/** @deprecated Use OBSERVE_SYSTEM + WEB_SYNTHESIZE_SYSTEM instead */
export const WEB_APP_SYSTEM = WEB_SYNTHESIZE_SYSTEM

/** @deprecated Use OBSERVE_SYSTEM + IMAGE_GEN_SYNTHESIZE_SYSTEM instead */
export const IMAGE_GEN_SYSTEM = IMAGE_GEN_SYNTHESIZE_SYSTEM

/** @deprecated Use buildObservePrompt + buildWebAppSynthesizePrompt instead */
export function buildWebAppPrompt(imageCount: number, useCase?: string, sourceContext?: string): string {
  return buildWebAppSynthesizePrompt('(no observations — legacy single-pass mode)', imageCount, useCase, sourceContext)
}

/** @deprecated Use buildObservePrompt + buildImageGenSynthesizePrompt instead */
export function buildImageGenPrompt(imageCount: number, useCase?: string, sourceContext?: string): string {
  return buildImageGenSynthesizePrompt('(no observations — legacy single-pass mode)', imageCount, useCase, sourceContext)
}

