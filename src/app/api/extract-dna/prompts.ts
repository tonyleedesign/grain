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

Image-Led vs Interface-Led: do NOT confuse "reference images contain photos" with "the design is image-led." A portfolio grid of cards is INTERFACE-LED — images are content inside layout. Image-led means images drive the LAYOUT: full-bleed heroes, photography as background, images breaking the grid. Dashboards and SaaS are almost always interface-led.

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


const ANTI_ARCHETYPE = `If you find yourself thinking "this looks like a brutalist/minimalist/editorial design," STOP. Name that archetype in your reasoning.archetype_check, then identify what makes THESE specific observations different from that archetype template. Your output must capture those differences. The archetype is a starting point for differentiation, not a template to fill in.`

const COMMITMENT_INSTRUCTIONS = `
Before generating JSON: confirm your direction_summary captures what's unmistakable, your anti_patterns capture what would ruin it, and every field is consistent with your axis positions.`

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

After describing what is most immediately striking, notice any secondary details that materially shape the image: surface quality, edge treatment, spatial tension, lighting behavior, or the relationship between type and image. If texture matters, describe what kind of physical texture it resembles: film grain, print dots, photocopy noise, scan noise, paper fiber, grit, bloom, blur, or compression. Only mention these if they are actually present and visually important.

After describing each image, describe what repeats across the set, what conflicts, what single quality makes the collection unmistakable, and what would make it feel generic if introduced.

Write naturally. No bullet points, no headers, no structure.`
}

// ═══════════════════════════════════════════════════════════
// PASS 2 — SYNTHESIZE (from observations, with user intent)
// ═══════════════════════════════════════════════════════════

export const WEB_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer. You are working from written observations of images — you did NOT see the images yourself. Your job is to translate visual observations into a structured design system for web/app interfaces.

Your output is a build spec. An AI engineer will use this DNA alongside the reference images to build a real website. They have strong design and UX knowledge — write your directions to activate that knowledge, not replace it. When describing sections, hint at the experience and user intent, not just the visual scene.

${ANTI_ARCHETYPE}

Web design is not just UI components — it includes how imagery lives in the layout. A hero-driven editorial site with full-bleed photography is fundamentally different from a dashboard with small thumbnails. Capture this distinction.

${WEB_AXES}

${QUALITY_GATES}`

export const IMAGE_GEN_SYNTHESIZE_SYSTEM = `You are a design DNA synthesizer. You are working from written observations of images — you did NOT see the images yourself. Your job is to translate visual observations into structured parameters for AI image generation.

${ANTI_ARCHETYPE}

Use professional photography and art direction vocabulary. Every value must be grounded in the observations. No vague adjectives. No hedging.

${IMAGE_GEN_AXES}

${QUALITY_GATES}`

export const DESIGN_MD_SYNTHESIZE_SYSTEM = `You are a design system synthesizer. You translate written visual observations from reference images into a structured design.md design system.

A design.md has two layers:
1. YAML tokens — exact machine-readable values using the official design.md schema
2. Prose sections — human-readable rationale explaining why those choices exist and how to apply them

The tokens say WHAT. The prose must say WHY: emotional intent, design personality, spatial philosophy, and drift boundaries.

Use official design.md token property names:
- Typography: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- Components: backgroundColor, textColor, typography, rounded, padding, size, height, width
- References: {colors.primary}, {rounded.md}, {typography.label-md}

Color token keys must be semantic for tooling compatibility. Use names like primary, on-primary, secondary, accent, surface, on-surface, muted, error. Evocative color names belong in prose only.

${ANTI_ARCHETYPE}

${WEB_AXES}

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
      { "intent": "describe what this transparent layer does and why, not rgba values" }
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
    "surface_feel": "Describe what surfaces feel like — material quality, tactility, sheen. Grounded in observations.",
    "light_and_depth": "Describe how light and shadow behave — absorptive vs reflective, crushed blacks vs open tonal range.",
    "texture_strategy": "Describe what creates texture, where it appears, and what stays clean. Be specific to this project, not generic."
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
  "creative_direction": [
    {
      "section": "Short label like Hero, Projects, Gallery",
      "direction": "Scene description: what visual materials appear, what the composition feels like, what kind of assets belong here. Vivid enough that a developer who has never seen the reference images can build it."
    }
  ],
  "theme_recommendation": {
    "library": "Pick from the LIBRARY CATALOG below. Can combine shadcn with add-on libraries (e.g. 'shadcn + aceternity-ui').",
    "theme_preset": "For DaisyUI only: retro | cyberpunk | synthwave | pastel | luxury | valentine | aqua | lofi | etc. null for others.",
    "rationale": "Why this library and theme fits the board aesthetic.",
    "component_notes": "Which components to prioritize, which variants (ghost/outline/filled), what patterns to use or avoid."
  },
  "composition_layout": {
    "page_archetype": "Describe the page type and overall organization in one vivid sentence.",
    "structure": "How sections are organized, what dominates, grid vs freeform, section rhythm and flow.",
    "spatial_rules": "Overlap behavior, depth layering, alignment, container discipline, whitespace role.",
    "responsive_notes": "What must survive on small screens, what can reflow, breakpoint priorities."
  },
  "anti_patterns": [
    { "this_is": "2-6 words", "not_that": "2-6 words" }
  ],
  "positioning": "1-2 sentences. Closest to [archetype], but [key differences]. Avoid drifting into [generic version].",
  "mood_tags": ["single", "words", "only"],
  "direction_summary": "Max 15 words. Format: [What it is] — not [what it's not]",
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "center|top-left|background|etc", "conflict": "optional" }
  ],
  "image_roles": [
    {
      "image_index": 0,
      "role": "usable_asset | style_reference",
      "description": "string — how to use this image or what it informed"
    }
  ]
}

Rules:
- reasoning comes FIRST and BINDS every field that follows. If reasoning identifies a visual quality (e.g. outlined typography), the matching field must preserve it. If anti-patterns reject something, no other field may reintroduce it.
- Exactly 5 colors with semantic roles — solid, intentional design colors from the observations, not ambient lighting.
- overlays: 1-3 entries. Describe intent (e.g. "dark scrim over hero images for text readability"), not rgba values.
- Typography: choose from the FONT CANDIDATES list below. Match classification and expressive traits to the observations. If no letterforms were described, match the mood. Do NOT pick fonts outside this list.
- border_radius: 0-24. 0=brutalist, 4-6=sharp, 8-12=balanced, 16+=rounded
- texture: vivid descriptions grounded in observations, not generic. What do surfaces feel like? How does light behave? Where does texture appear?
- motion: level must match approach — static/subtle = css-only or framer-motion, expressive = gsap, immersive = webgl/three.js.
- creative_direction: Richest for hero and showcase sections. Ground in observations — do not invent visuals not present in any reference. Describe the scene and asset world, not CSS or coordinates. Do not reference images by number. Distinguish surface texture from image content.
- Exactly 3 anti_patterns — directional guardrails, not universal bans. Describe reusable visual direction, not literal subject matter. Prefer design qualities ("lifestyle softness") over depicted scenes.
- positioning: "Closest to [archetype], but [key differences]. Avoid drifting into [generic version]."
- 3-5 mood_tags, single evocative words.
- 3-5 evidence items grounding key patterns in specific images.
- image_roles: one per image. "usable_asset" = content for the final design. "style_reference" = vibe to draw from, not embed. Default to style_reference when ambiguous.
- direction_summary: synthesize anti-patterns into one positioning statement with contrast.
- theme_recommendation: match aesthetic to LIBRARY CATALOG below. component_notes should name specific patterns to use and avoid.

LIBRARY CATALOG — match aesthetic direction to library:
Base libraries (pick one):
- shadcn: Clean, minimal, professional. The safe default for SaaS, apps, dashboards.
- heroui: Sleek, premium, Apple-inspired. Smooth animations, elegant dark mode, soft gradients.
- mantine: Developer-centric, 120+ components. Built-in rich text editor, date pickers, spotlight search. Best for complex apps.
- chakra-ui: Accessible, composable, slightly playful. Rounded corners, generous spacing.
- ant-design: Enterprise, structured, data-dense. Strong tables, forms, systematic iconography.
- daisyui: Theme-driven, 35 named presets (retro, cyberpunk, synthwave, pastel, luxury, lofi, etc.). Pure CSS, zero JS.
- preline: Modern, airy, marketing-ready. Generous whitespace, 640+ components. Great for landing pages.
- flowbite: Corporate-professional. Kanban boards, CRUD tables, calendars. Enterprise dashboards.
- tremor: Data-forward, analytical. Charts, KPI cards, metric displays. Stripe-dashboard feel.
- park-ui: Refined, editorial. Multi-framework (React, Solid, Vue). Chakra-quality outside React.
- flyonui: DaisyUI simplicity + JavaScript interactivity. Semantic class names with real components.

shadcn add-on libraries (combine with shadcn):
- aceternity-ui: Dramatic 3D cards, spotlight effects, parallax, aurora backgrounds. Premium SaaS marketing.
- magic-ui: Shimmer borders, orbit animations, number tickers. Playful motion accents.
- motion-primitives: Scroll reveals, staggered lists, text animations. Tasteful, not showy.
- animate-ui: Motion via shadcn CLI. Tight integration, installable via npx shadcn add.
- kokonut-ui: Conversion-oriented hover states, entrance animations. Marketing/startup pages.
- cult-ui: Curated composable components with restrained animation. Production polish.

Niche aesthetics:
- neobrutalism-components: Thick borders, hard drop shadows, saturated colors. Anti-corporate, graphic-design-influenced.
- retroui: Neo-brutalist + retro web flavor. Playful, personality-driven.
- 8bitcn: Pixel borders, chiptune aesthetic, NES-era UI. Gaming, indie, novelty.
- untitled-ui-react: Figma-first premium design system. 5000+ components, systematic tokens.
- composition_layout: All four fields should be vivid descriptions grounded in observations, not selections from a fixed menu. page_archetype names the structural shape. structure describes how sections flow and what leads. spatial_rules captures overlap, alignment, and container discipline. responsive_notes identifies what must be preserved vs what can reflow. Avoid generic descriptions that could apply to any design.
- REJECT: sentences longer than 6 words (except direction_summary, creative_direction entries, composition_layout fields, and theme_recommendation fields), vague adjectives, metaphors.
${COMMITMENT_INSTRUCTIONS}
${fontShortlist ? `
FONT CANDIDATES — choose display and body fonts from this list ONLY:
${fontShortlist}
` : ''}
Return ONLY valid JSON, no markdown fences, no explanation.`
}

export function buildDesignMdSynthesizePrompt(
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
    ? `\nThe user is building: "${useCase}"\nLet this shape token choices and prose rationale. The design system must serve this specific use case.\n`
    : ''

  const sourceBlock = sourceContext
    ? `\nReference context: "${sourceContext}" — use this to inform era and cultural references in prose.\n`
    : ''

  const appealBlock = appealContext
    ? `\nThe user said what draws them to these images: "${appealContext}"\nThis is the priority signal for resolving ambiguity. Amplify what they're drawn to.\n`
    : ''

  let feedbackBlock = ''
  if (feedback) {
    feedbackBlock = `\n\nIMPORTANT — the user rejected the previous extraction: "${feedback}"\nDo not repeat the rejected direction.`
    if (previousDna) {
      feedbackBlock += `\n\nREJECTED extraction:\n${JSON.stringify(previousDna, null, 2)}`
    }
  }

  return `Here are visual observations from ${imageCount} image${imageCount !== 1 ? 's' : ''}:

---
${observations}
---
${useCaseBlock}${sourceBlock}${appealBlock}${feedbackBlock}

Synthesize these into a design.md design system.

Return a JSON object with this exact structure:

{
  "reasoning": {
    "per_image": ["One sentence per image — the single most distinctive visual quality, literal not interpreted"],
    "repeated_signals": "What visual patterns appeared consistently across images",
    "tensions": "Where images disagreed or pulled in different directions",
    "synthesis": "How you resolved tensions — what you amplified, what you deprioritized, and why",
    "archetype_check": "The nearest design archetype + specifically how THIS collection differs from that template"
  },
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "center|top-left|top-right|bottom-left|bottom-right|top|bottom|left|right|background", "conflict": "optional — what this image disagrees on vs the others" }
  ],
  "name": "2-5 words, human-readable design system name",
  "tokens": {
    "colors": {
      "primary": "#1a1a2e",
      "on-primary": "#ffffff",
      "secondary": "#6c7278",
      "accent": "#b8422e",
      "surface": "#f7f5f2",
      "on-surface": "#1a1c1e"
    },
    "typography": {
      "headline-display": { "fontFamily": "Playfair Display", "fontSize": "56px", "fontWeight": 700, "lineHeight": "1.1", "letterSpacing": "-0.02em" },
      "headline-lg": { "fontFamily": "Playfair Display", "fontSize": "36px", "fontWeight": 600, "lineHeight": "1.2" },
      "body-lg": { "fontFamily": "Inter", "fontSize": "18px", "fontWeight": 400, "lineHeight": "1.6" },
      "body-md": { "fontFamily": "Inter", "fontSize": "16px", "fontWeight": 400, "lineHeight": "1.6" },
      "label-md": { "fontFamily": "Inter", "fontSize": "12px", "fontWeight": 500, "lineHeight": "1.4", "letterSpacing": "0.06em" }
    },
    "rounded": {
      "sm": "4px",
      "md": "8px",
      "lg": "16px",
      "xl": "24px",
      "full": "9999px"
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "16px",
      "lg": "32px",
      "xl": "64px"
    },
    "components": {
      "button-primary": {
        "backgroundColor": "{colors.primary}",
        "textColor": "{colors.on-primary}",
        "typography": "{typography.label-md}",
        "rounded": "{rounded.md}",
        "padding": "12px 24px"
      }
    }
  },
  "overview": "2-3 paragraphs. Open with the single most distinctive quality. Describe the emotional register. Name what makes it unmistakable. End with what it refuses to be.",
  "colors": "Describe each color by emotional role, not hex value. Use evocative names in prose only. Explain hierarchy and mood.",
  "typography": "Describe each typeface as a personality. Explain hierarchy, readability, and contrast or harmony.",
  "layoutSpacing": "Describe spatial philosophy, density, grid behavior, and relationship to user attention.",
  "elevationDepth": "Describe shadow/layering strategy or the flat-design alternative.",
  "shapes": "Describe what the radius scale communicates and where sharpness or softness belongs.",
  "components": "Describe key interactive elements in terms of feel and behavior.",
  "dosAndDonts": "3-5 directional rules. Format each as: 'Favor [quality] — not [drift]'.",
  "creativeDirection": "Describe mood, cultural references, visual metaphors, and decision-making lens.",
  "motion": "Describe animation philosophy, timing, easing, and what motion would feel wrong."
}

Token rules:
- colors: 5-7 semantic tokens. Must include primary. Prefer primary, on-primary, secondary, accent, surface, on-surface, muted, error. Exact hex only.
- typography: include all 5 levels. Use official design.md keys. fontFamily must be a real Google Font name.
- rounded: all 5 scales required.
- spacing: all 5 scales required.
- components: 1-3 key components using official component props and root-path references.
- evidence: 3-5 items. image_index is 0-based. quality is 2-4 words max. conflict is optional, only when that image genuinely pulls against the others.

Prose rules:
- Every prose field explains WHY, not WHAT.
- Evocative color names belong in prose only.
- No markdown headings inside prose fields.
- Be specific enough that this could only describe this board.
${fontShortlist ? `\nFont candidates — choose fontFamily names from this list only:\n${fontShortlist}\n` : ''}
${COMMITMENT_INSTRUCTIONS}

Return ONLY valid JSON. No markdown fences. No explanation.`
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
  "positioning": "1-2 sentences. Closest to [archetype], but [key differences]. Avoid drifting into [generic version].",
  "mood_tags": ["single", "words", "only"],
  "direction_summary": "Max 15 words. Format: [What it is] — not [what it's not]",
  "evidence": [
    { "image_index": 0, "quality": "2-4 words", "region_hint": "position", "conflict": "optional" }
  ]
}

Rules:
- The reasoning field comes FIRST. It is a trace of what was observed and how those observations were resolved into one direction. Every field that follows is a BINDING consequence of the reasoning. If the reasoning identifies a specific visual quality, the matching field must preserve it — for example, if the reasoning calls for outlined or skeletal typography, do not replace it with a generic filled sans. If your anti-patterns reject something, no other field may reintroduce it. Read your reasoning back before generating each field and verify it follows.
- 5 hex colors that capture the dominant palette — derived from color descriptions in observations.
- medium_type.primary: choose ONE. sub_tags: 2-4 specific technique references.
- lighting: 2-4 professional terms. NO camera settings like f/1.4.
- texture.level: one of four enums. keywords: 2-4 specific texture words.
- Exactly 3 anti_patterns with concrete visual drift boundaries. Anti-patterns are directional guardrails, not universal bans. They should describe what this direction moves away from, not claim that the rejected quality is always wrong. Anti-patterns must describe reusable visual direction, not the literal subject matter of a specific reference image. Prefer the design quality an image implies ("lifestyle softness", "friendly warmth", "polished luxury sheen") over the exact depicted pose, object, or scene, unless the medium is image generation and subject matter is structurally important.
- positioning: rewrite the archetype_check as a compact positioning statement for downstream design and coding models. Format: "Closest to [archetype], but [key differences]. Avoid drifting into [generic version]." Keep only the most important distinctions. Do not include brand names unless they are essential.
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

