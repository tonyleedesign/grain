// Medium-specific Claude prompts for DNA extraction.
// Co-located with route — tight coupling between prompt and expected JSON schema.
//
// Prompt architecture (3 layers):
// 1. System: Identity + Axis Reasoning + Quality Gates (taste calibration)
// 2. User: JSON schema + rules + use case context
// 3. User (tail): Commitment instructions (force opinionated output)

// ─── Shared prompt building blocks ───

const SHARED_AXES = `- Warm ↔ Cool
- Organic ↔ Geometric
- Dense ↔ Spacious
- Polished ↔ Raw`

const WEB_AXES = `Before extracting, evaluate the images along these axes and COMMIT to a position:
${SHARED_AXES}
- Editorial ↔ Systematic
- Image-Led ↔ Interface-Led
- Saturated ↔ Muted

Pick ONE side of each axis. Do not hedge. Your entire extraction must be internally consistent with these positions. If images pull in multiple directions, choose the DOMINANT signal — do not average.`

const IMAGE_GEN_AXES = `Before extracting, evaluate the images along these axes and COMMIT to a position:
${SHARED_AXES}
- Sharp ↔ Soft
- Hard Light ↔ Diffused
- Contemporary ↔ Nostalgic

Pick ONE side of each axis. Do not hedge. Your entire extraction must be internally consistent with these positions. If images pull in multiple directions, choose the DOMINANT signal — do not average.`

const QUALITY_GATES = `Quality gates — every output must pass these:
- Anti-patterns must be CONCRETE visual boundaries. Good: "bold geometric type" vs "playful script fonts". Bad: "good design" vs "bad design".
- Direction summary must be GROUNDED in what the images actually show — describe the aesthetic through visible subjects, settings, and mood. Good: "Nocturnal urban motion — neon-lit, blurred, voyeuristic." Bad: "Poison green bleeds crimson." Bad: "Modern and clean design." No abstract poetry — evocative but accurate.
- Colors must have a clear dominant/accent hierarchy. 5 equally weighted colors = failure.
- Typography: SPECIFIC Google Font families that match the mood. NEVER default to Inter, Roboto, Open Sans, Lato, or Montserrat.
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
- Image treatment: high-contrast/color-graded = saturated; desaturated/soft-focus = muted.

Image-Led ↔ Interface-Led governs:
- IMPORTANT: do NOT confuse "reference images contain photos" with "the design is image-led." A portfolio site showing work in a grid of cards is INTERFACE-LED — the images are content, not design. Image-led means images drive the LAYOUT: full-bleed heroes, photography as background, images breaking the grid. Ask: "does the layout serve the images, or do images sit inside the layout?" If images are contained in cards/grids, that's interface-led.
- Also consider the use case: dashboards, tools, and SaaS are almost always interface-led. Editorial, fashion, and photography sites lean image-led. Let the use case inform this axis.
- Image treatment role: hero-driven = image-led; supporting/decorative/minimal = interface-led.
- Typography: image-led designs can use simpler type (images do the talking); interface-led designs need stronger, more distinctive typography.
- Motion: image-led sites often use parallax/scroll reveals on images; interface-led sites use functional transitions.

Cross-check: read your color hex values, mood tags, typography, border radius, texture, and motion together. They must all tell the SAME story. If any field feels like it belongs to a different project, fix it.`

const COMMITMENT_INSTRUCTIONS = `
Before generating your JSON, internally commit:
1. Which axis positions describe these images? (pick sides, don't hedge)
2. What is the ONE thing that makes this aesthetic unmistakable?
3. What would RUIN this aesthetic if added?

Your anti-patterns should answer #3. Your direction_summary should answer #2. Every other field must be consistent with #1.`

// ─── Web/App System Prompt ───

export const WEB_APP_SYSTEM = `You are a design DNA extractor with strong visual taste. Your job is to identify what makes a set of images DISTINCTIVE for web/app interface design — the specific combination of choices that could not be confused with any other aesthetic. Generic output is failure. If your output could describe any startup landing page, you have failed.

Web design is not just UI components — it includes how imagery lives in the layout. A hero-driven editorial site with full-bleed photography is fundamentally different from a dashboard with small thumbnails. Capture this distinction.

Every value must be grounded in visible, repeated patterns across the images. No filler. No hedging.

If you recognize the source material — a specific film, photographer, art movement, or era — let that knowledge inform your extraction. A Wong Kar-wai still implies different motion and texture than a Wes Anderson still, even if the raw colors overlap. Use recognition as context, not override — the visible patterns still lead.

${WEB_AXES}

${QUALITY_GATES}

${CONSISTENCY_CHECK}`

// ─── Image Gen System Prompt ───

export const IMAGE_GEN_SYSTEM = `You are a design DNA extractor with strong visual taste, specialized in art direction for image generation. Your job is to identify what makes a set of images DISTINCTIVE — the specific visual language that could not be confused with any other aesthetic. Generic output is failure. If your output could describe any stock photo collection, you have failed.

Every value must be grounded in visible, repeated patterns across the images. Use professional photography and art direction vocabulary. No vague adjectives. No hedging.

If you recognize the source material — a specific film, photographer, art movement, or era — let that knowledge inform your extraction. Recognition provides context for lighting vocabulary, texture expectations, and era-appropriate technique references. Use it as context, not override — the visible patterns still lead.

${IMAGE_GEN_AXES}

${QUALITY_GATES}`

// ─── Web/App User Prompt ───

export function buildWebAppPrompt(imageCount: number, useCase?: string, sourceContext?: string, appealContext?: string): string {
  const useCaseContext = useCase
    ? `\nThe user is building: "${useCase}"
This is critical context — it should actively shape your extraction:
- Typography should match what works for this type of project (a portfolio needs different type than a SaaS dashboard)
- Color roles should be assigned for this use case (a music school landing page uses accent differently than an analytics tool)
- Anti-patterns should reject what would be wrong for THIS specific project, not just generically bad design
- Image treatment should reflect how imagery would actually be used in this type of project
- Direction summary should position the design relative to others in this category\n`
    : ''

  const sourceContextBlock = sourceContext
    ? `\nReference context provided by the user: "${sourceContext}"
Use this to inform your extraction — if you recognize the source material, let it shape your understanding of the visual language, era, and intent behind these images.\n`
    : ''

  const appealBlock = appealContext
    ? `\nThe user said what draws them to these images: "${appealContext}"
This is their subjective lens — it tells you what to AMPLIFY in the extraction. If they say "the motion blur and neon glow," your color palette, texture, and mood should all lean into that. If they say "the clean typography and whitespace," focus there instead. The user's stated appeal is the priority signal for resolving ambiguity.\n`
    : ''

  return `Analyze these ${imageCount} images and extract a unified Design DNA for web/app design.
${useCaseContext}${sourceContextBlock}${appealBlock}
Return a JSON object with this exact structure:
{
  "board_name": "2-4 words, distinctive",
  "color_palette": {
    "colors": [
      { "hex": "#hex", "role": "primary|secondary|accent|dark|light" }
    ],
    "overlays": [
      { "rgba": "rgba(r, g, b, alpha)", "use": "what this transparent layer does — e.g. hero scrim, cinematic color grade, card tint, section divider, hover state" }
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
    "background": ["2-4 keywords: e.g. noise overlay, gradient mesh, grain, dot pattern, flat color, subtle texture"],
    "finish": "matte|glossy|frosted|raw",
    "light_behavior": "absorptive|reflective|mixed",
    "shadow_crush": "none|moderate|heavy"
  },
  "motion": {
    "level": "static|subtle|expressive|immersive",
    "techniques": ["2-4 keywords: e.g. scroll-triggered reveals, parallax layers, page transitions, hover morphs, staggered entrances"],
    "approach": "css-only|framer-motion|gsap|webgl/three.js"
  },
  "image_treatment": {
    "role": "hero-driven|supporting|decorative|minimal",
    "treatment": ["2-4 keywords: e.g. duotone, grain overlay, desaturated, color-graded, high-contrast, soft-focus"],
    "placement": ["2-4 keywords: e.g. full-bleed, overlapping text, contained in cards, background texture, edge-bleed, floating cutouts"],
    "text_overlay": "dark-scrim|gradient-fade|clear-space|knockout|none"
  },
  "project_instructions": {
    "project_summary": "Rewrite the user's use case as a clear, professional 1-sentence project description. Fix typos, clarify intent, remove ambiguity.",
    "sections": ["4-6 key pages/sections. If images show specific layout patterns (grids, stacked sections, card layouts), describe what you see. If images are mood/aesthetic references without clear layouts, recommend best practices for this project type."],
    "content_tone": ["3-4 directives on writing style and voice — be specific to this project type"],
    "standout_tips": ["2-3 tips on what makes this type of project stand out — not generic design advice, specific to the use case"]
  },
  "anti_patterns": [
    { "this_is": "2-6 words", "not_that": "2-6 words" }
  ],
  "mood_tags": ["single", "words", "only"],
  "direction_summary": "Max 15 words. Format: [What it is] — not [what it's not]",
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "center|top-left|background|etc", "conflict": "optional — only if this image disagrees with the dominant pattern, e.g. warmer palette than others" }
  ]
}

Rules:
- Exactly 5 colors with semantic roles (primary, secondary, accent, dark, light). These must be SOLID, INTENTIONAL design colors — extracted from UI elements, text, backgrounds, and deliberate accents. NOT from photographic color casts or ambient lighting.
- overlays: 2-4 transparent layers as rgba values. This is where color grades, scrims, tints, and atmospheric effects go. A green tint across dark photography = rgba(0,255,100,0.12) overlay, NOT a #00FF99 solid color. Ambient lighting, color grading, hover states, shadow tints, and glass effects all belong here. If no transparency is visible in the design, use common patterns like dark scrims for text readability.
- Typography: recommend real Google Font families. Match the visual weight and style you see.
- border_radius: single number 0-24. 0=brutalist, 4-6=sharp professional, 8-12=balanced, 16+=friendly rounded
- texture: what the surface feels like. background=visual treatments applied to page backgrounds (noise, grain, gradients, patterns). finish=overall surface quality. light_behavior=how surfaces respond to light (absorptive=flat/matte, no highlights; reflective=glossy/glass, specular highlights; mixed=both present). shadow_crush=how much shadow detail is preserved (none=full shadow detail visible; moderate=some crushed blacks; heavy=deep blacks with lost detail). If images show flat/clean design, say so — don't invent texture that isn't there.
- motion: infer animation level from the design style. static=no animation. subtle=fade-ins, micro-interactions (css/framer-motion). expressive=scroll sequences, staggered reveals (gsap). immersive=3D scenes, shaders (webgl). Match approach to level. If images suggest editorial/narrative layouts, lean expressive. If minimal/utilitarian, lean static/subtle.
- project_instructions: sections should describe layout patterns from the images when visible (grids, stacked sections, cards, etc). When images are purely aesthetic references, recommend best practices for this project type instead. content_tone and standout_tips should be specific to this project type, not generic design advice. project_summary: rewrite the user's raw input into a clean, professional 1-sentence description — fix typos, clarify intent, make it unambiguous.
- Exactly 3 anti_patterns. Each pair must be concrete visual boundaries, not vague.
- 3-5 mood_tags, single words only. Must be evocative — not "modern" or "clean".
- 3-5 evidence items grounding key patterns in specific images. If an image conflicts with the dominant pattern (different color temperature, different texture, different energy), add a "conflict" field explaining what disagrees — this helps designers understand where you made judgment calls
- direction_summary must synthesize the anti-patterns into one positioning statement with contrast
- REJECT: sentences longer than 6 words (except direction_summary which gets 15), vague adjectives, metaphors
${COMMITMENT_INSTRUCTIONS}

Return ONLY valid JSON, no markdown fences, no explanation.`
}

// ─── Image Gen User Prompt ───

export function buildImageGenPrompt(imageCount: number, useCase?: string, sourceContext?: string, appealContext?: string): string {
  const useCaseContext = useCase
    ? `\nThe user wants to generate: "${useCase}"
This is critical context — it should actively shape your extraction:
- Lighting and composition should reflect what works for this type of imagery
- Anti-patterns should reject what would be wrong for THIS specific use case
- Medium type and technique tags should be tailored to this purpose
- Direction summary should position the aesthetic relative to others in this category\n`
    : ''

  const sourceContextBlock = sourceContext
    ? `\nReference context provided by the user: "${sourceContext}"
Use this to inform your extraction — if you recognize the source material, let it shape your understanding of the visual language, era, and intent behind these images.\n`
    : ''

  const appealBlock = appealContext
    ? `\nThe user said what draws them to these images: "${appealContext}"
This is their subjective lens — it tells you what to AMPLIFY in the extraction. If they say "the motion blur and neon glow," your color palette, texture, and mood should all lean into that. If they say "the grain and faded tones," focus there instead. The user's stated appeal is the priority signal for resolving ambiguity.\n`
    : ''

  return `Analyze these ${imageCount} images and extract a unified Design DNA for image generation.
${useCaseContext}${sourceContextBlock}${appealBlock}
Return a JSON object with this exact structure:
{
  "board_name": "2-4 words, distinctive",
  "color_palette": {
    "colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "mood": "2-4 word mood description"
  },
  "medium_type": {
    "primary": "photography|illustration|3d|mixed",
    "sub_tags": ["film stock", "render style", "technique tags"]
  },
  "lighting": ["professional lighting terms", "e.g. soft diffused window light"],
  "texture": {
    "level": "clean|light|moderate|heavy",
    "keywords": ["grain", "noise", "smooth", "matte"]
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
    { "image_index": 0, "quality": "2-4 words", "region_hint": "center|top-left|background|etc", "conflict": "optional — only if this image disagrees with the dominant pattern" }
  ]
}

Rules:
- 5 hex colors that capture the dominant palette
- medium_type.primary: choose ONE. sub_tags: 2-4 specific technique references
- lighting: 2-4 professional terms. NO camera settings like f/1.4 — use descriptive terms instead
- texture.level: one of four enums. keywords: 2-4 specific texture words
- Exactly 3 anti_patterns with concrete visual boundaries
- 3-5 mood_tags, single words only. Must be evocative — not "cinematic" or "aesthetic".
- 3-5 evidence items. Add a "conflict" field on any image that disagrees with the dominant pattern
- direction_summary synthesizes anti-patterns into one positioning statement with contrast
- REJECT: camera settings (f/1.4, ISO 800), sentences >6 words (except direction_summary), vague adjectives
${COMMITMENT_INSTRUCTIONS}

Return ONLY valid JSON, no markdown fences, no explanation.`
}
