// Design DNA types — medium-aware, structured for both designer validation and AI export.
// Reference: grain-prd.md Section 5.3, 14

// --- Mediums ---
// Extensible to 'brand' | 'motion' | 'social' later
export type Medium = 'web' | 'image'

// --- Shared primitives ---

export interface DNAReasoning {
  // --- Observation layer (what was seen) ---
  per_image: string[]        // What was seen in each image — literal, not interpreted
  repeated_signals: string   // What visual patterns appeared across multiple images
  tensions: string           // Where images disagreed or pulled in different directions

  // --- Conclusion layer (what was decided) ---
  synthesis: string          // How tensions were resolved, what was amplified/deprioritized
  archetype_check: string    // Nearest archetype + specifically how THIS collection differs
}

export interface AntiPattern {
  this_is: string
  not_that: string
}

export interface PatternEvidence {
  image_index: number
  quality: string       // 2-4 words, e.g. "warm amber tones"
  region_hint: string   // e.g. "center", "top-left", "background"
  conflict?: string     // optional: what this image disagrees on, e.g. "warmer palette than others"
}

// --- Web/App DNA ---

export interface WebAppDNA {
  board_name: string
  positioning?: string                           // 1-2 sentences: nearest archetype + key differences + drift warning
  creative_direction?: Array<{
    section: string    // short label like "Hero", "Projects", "Gallery"
    direction: string  // vivid scene description: assets, composition, background, overlays
  }>
  color_palette: {
    colors: Array<{ hex: string; role: string }>  // 5 semantic colors
    overlays: Array<{ rgba: string; use: string }> // transparent layers: scrims, tints, color grades
    relationship: string                           // 4 words max
  }
  typography: {
    display: { family: string; weight: number; classification: string }
    body: { family: string; weight: number; classification: string }
  }
  border_radius: number                            // 0-24px
  spacing_density: 'compact' | 'comfortable' | 'spacious'
  shadow_style: 'none' | 'subtle' | 'layered' | 'elevated'
  texture: {
    background: string[]                           // e.g. ["noise overlay", "gradient mesh", "grain"]
    finish: 'matte' | 'glossy' | 'frosted' | 'raw'
    light_behavior: 'absorptive' | 'reflective' | 'mixed'  // how surfaces respond to light
    shadow_crush: 'none' | 'moderate' | 'heavy'             // how much shadow detail is preserved
    primary_texture?: {
      family: 'film-grain' | 'halftone' | 'photocopy-noise' | 'scan-noise' | 'paper-fiber' | 'asphalt-grit' | 'compression-artifacts' | 'none'
      intensity: 'subtle' | 'moderate' | 'heavy'
      application: 'image-only' | 'background-only' | 'surface-only' | 'global'
      rationale: string
    }
  }
  motion: {
    level: 'static' | 'subtle' | 'expressive' | 'immersive'
    techniques: string[]                           // e.g. ["scroll-triggered reveals", "parallax layers"]
    approach: 'css-only' | 'framer-motion' | 'gsap' | 'webgl/three.js'
  }
  image_treatment: {
    role: 'hero-driven' | 'supporting' | 'decorative' | 'minimal'
    treatment: string[]                            // e.g. ["duotone", "grain overlay", "desaturated"]
    placement: string[]                            // e.g. ["full-bleed", "overlapping text", "contained in cards"]
    text_overlay: 'dark-scrim' | 'gradient-fade' | 'clear-space' | 'knockout' | 'none'
  }
  project_instructions: {
    project_summary: string                          // AI-interpreted version of use case, 1 sentence, no typos
    sections: string[]                               // 4-6 pages/sections with one-line descriptions
    content_tone: string[]                           // 3-4 writing style directives
    standout_tips: string[]                          // 2-3 tips specific to this project type
  }
  anti_patterns: AntiPattern[]                     // 3 pairs
  mood_tags: string[]                              // 3-5 single words
  direction_summary: string                        // max 15 words
  evidence: PatternEvidence[]                      // 3-5 items
  reasoning?: DNAReasoning                         // Two-pass reasoning trace
}

// --- Image Gen DNA ---

export interface ImageGenDNA {
  board_name: string
  positioning?: string
  color_palette: {
    colors: string[]   // 5 hex values
    mood: string
  }
  medium_type: {
    primary: 'photography' | 'illustration' | '3d' | 'mixed'
    sub_tags: string[]
  }
  lighting: string[]
  texture: {
    level: 'clean' | 'light' | 'moderate' | 'heavy'
    keywords: string[]
  }
  composition: {
    style: string
    description: string
  }
  era_movement: string[]
  anti_patterns: AntiPattern[]
  mood_tags: string[]
  direction_summary: string
  evidence: PatternEvidence[]
  reasoning?: DNAReasoning                         // Two-pass reasoning trace
}

// --- Discriminated union ---

export type BoardDNA =
  | { medium: 'web'; dna: WebAppDNA }
  | { medium: 'image'; dna: ImageGenDNA }

// --- Organize result (grouping only, no DNA) ---

export interface OrganizeResult {
  boards: {
    board_name: string
    image_ids: string[]
  }[]
}

// --- Feedback loop ---

export interface DNAFeedback {
  board_id: string
  rating: 'worked' | 'needs_tweaking'
  what_was_off?: string
  created_at: string
}

// --- Image reference passed to the organize API (unchanged) ---

export interface CanvasImage {
  id: string
  url: string
  position_x: number
  position_y: number
}
