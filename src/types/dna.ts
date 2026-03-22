// Design DNA types — the structured output from Claude's image analysis.
// Reference: grain-prd.md Section 5.3, 14

export interface BoardDNA {
  board_name: string
  core_patterns: string[]
  color_palette: {
    description: string
    hex_values: string[]
  }
  mood_tags: string[]
  style_tags: string[]
  material_tags: string[]
  composition: string
  era_reference: string
  overall_feel: string
  what_makes_distinct: string
  typography_direction: string
  font_pairing: {
    display: string
    body: string
    reasoning: string
  }
}

export interface OrganizeResult {
  boards: {
    dna: BoardDNA
    image_ids: string[]
  }[]
}

// Image reference passed to the organize API
export interface CanvasImage {
  id: string
  url: string
  position_x: number
  position_y: number
}
