// Font matcher — filters Google Fonts index by classification + expressive traits
// to produce a shortlist for Pass 2 synthesis.

import fontIndex from '@/data/font-index.json'

interface FontEntry {
  classification: string[]
  expressive: Record<string, number>
  themes: string[]
}

const fonts = fontIndex as Record<string, FontEntry>

// Maps classification terms used in prompts/axes to Google Fonts tag paths
const CLASSIFICATION_MAP: Record<string, string[]> = {
  'geometric-sans': ['/Sans/Geometric'],
  'humanist-sans': ['/Sans/Humanist'],
  'neo-grotesque': ['/Sans/Neo Grotesque'],
  'grotesque': ['/Sans/Grotesque'],
  'rounded-sans': ['/Sans/Rounded'],
  'transitional-serif': ['/Serif/Transitional'],
  'didone': ['/Serif/Didone'],
  'old-style-serif': ['/Serif/Old Style Garalde', '/Serif/Humanist Venetian'],
  'modern-serif': ['/Serif/Modern'],
  'slab': ['/Slab/Clarendon', '/Slab/Geometric', '/Slab/Humanist'],
  'display': ['/Sans/Geometric', '/Sans/Grotesque', '/Serif/Fat Face'],
  'mono': ['/Monospace/Monospace'],
  'script': ['/Script/Formal', '/Script/Informal'],
  'handwritten': ['/Script/Handwritten'],
  // Axis-derived terms
  'serif': ['/Serif/Transitional', '/Serif/Didone', '/Serif/Modern', '/Serif/Old Style Garalde', '/Serif/Humanist Venetian', '/Serif/Scotch'],
  'sans-serif': ['/Sans/Geometric', '/Sans/Humanist', '/Sans/Neo Grotesque', '/Sans/Grotesque'],
}

// Maps mood/axis terms to expressive traits and their ideal scores
const MOOD_MAP: Record<string, { trait: string; min: number }[]> = {
  'warm': [{ trait: 'Sincere', min: 50 }, { trait: 'Calm', min: 50 }],
  'cool': [{ trait: 'Competent', min: 50 }, { trait: 'Stiff', min: 20 }],
  'playful': [{ trait: 'Playful', min: 40 }, { trait: 'Happy', min: 30 }],
  'serious': [{ trait: 'Business', min: 60 }, { trait: 'Competent', min: 50 }],
  'raw': [{ trait: 'Rugged', min: 50 }],
  'polished': [{ trait: 'Business', min: 60 }, { trait: 'Calm', min: 60 }],
  'vintage': [{ trait: 'Vintage', min: 50 }],
  'futuristic': [{ trait: 'Futuristic', min: 40 }, { trait: 'Innovative', min: 30 }],
  'expressive': [{ trait: 'Loud', min: 50 }, { trait: 'Artistic', min: 30 }],
  'restrained': [{ trait: 'Calm', min: 60 }, { trait: 'Competent', min: 50 }],
  'loud': [{ trait: 'Loud', min: 50 }],
  'quiet': [{ trait: 'Calm', min: 60 }],
  'rugged': [{ trait: 'Rugged', min: 60 }],
  'sophisticated': [{ trait: 'Sophisticated', min: 40 }, { trait: 'Business', min: 50 }],
  'artistic': [{ trait: 'Artistic', min: 40 }],
  'industrial': [{ trait: 'Rugged', min: 50 }, { trait: 'Stiff', min: 30 }],
  'editorial': [{ trait: 'Sophisticated', min: 30 }, { trait: 'Business', min: 50 }],
  'brutalist': [{ trait: 'Rugged', min: 50 }, { trait: 'Loud', min: 40 }],
  'organic': [{ trait: 'Sincere', min: 40 }],
  'geometric': [{ trait: 'Competent', min: 40 }],
}

export interface FontMatch {
  name: string
  classification: string[]
  score: number
  traits: Record<string, number>
}

/**
 * Find fonts matching classification and mood criteria.
 * Returns a ranked shortlist of up to `limit` fonts.
 */
export function matchFonts(opts: {
  classifications?: string[]  // e.g. ['geometric-sans', 'neo-grotesque']
  moods?: string[]            // e.g. ['raw', 'industrial', 'vintage']
  themes?: string[]           // e.g. ['Stencil', 'Art Deco']
  excludeFonts?: string[]     // e.g. ['Inter', 'Roboto'] — fonts to explicitly exclude
  role?: 'display' | 'body'   // display penalizes generic/calm fonts, body rewards readability
  limit?: number
}): FontMatch[] {
  const { classifications = [], moods = [], themes = [], excludeFonts = [], role, limit = 15 } = opts

  // Resolve classification terms to tag paths
  const targetTags = new Set<string>()
  for (const cls of classifications) {
    const mapped = CLASSIFICATION_MAP[cls.toLowerCase()]
    if (mapped) mapped.forEach(t => targetTags.add(t))
  }

  // Resolve mood terms to trait requirements
  const traitRequirements: { trait: string; min: number }[] = []
  for (const mood of moods) {
    const mapped = MOOD_MAP[mood.toLowerCase()]
    if (mapped) traitRequirements.push(...mapped)
  }

  const excludeSet = new Set(excludeFonts.map(f => f.toLowerCase()))

  // Filter out non-Latin script-specific font variants
  const SCRIPT_FONT_PATTERN = /^(Noto (Sans|Serif)|IBM Plex Sans) [A-Z]/

  const results: FontMatch[] = []

  for (const [name, entry] of Object.entries(fonts)) {
    if (excludeSet.has(name.toLowerCase())) continue
    if (SCRIPT_FONT_PATTERN.test(name)) continue

    let score = 0

    // Classification match
    if (targetTags.size > 0) {
      const classMatch = entry.classification.some(c => targetTags.has(c))
      if (!classMatch) continue // Hard filter: must match classification
      score += 50
    }

    // Theme match
    if (themes.length > 0) {
      const themeMatch = themes.some(t =>
        entry.themes.some(et => et.toLowerCase() === t.toLowerCase())
      )
      if (themeMatch) score += 30
    }

    // Expressive trait scoring
    for (const req of traitRequirements) {
      const val = entry.expressive[req.trait] || 0
      if (val >= req.min) {
        score += val / 10 // Proportional boost
      }
    }

    // Role-based adjustments
    if (role === 'display') {
      // Display fonts should be distinctive, not generic. Penalize high Calm+Business
      // without offsetting expressive character.
      const calm = entry.expressive['Calm'] || 0
      const business = entry.expressive['Business'] || 0
      const loud = entry.expressive['Loud'] || 0
      const rugged = entry.expressive['Rugged'] || 0
      const artistic = entry.expressive['Artistic'] || 0
      const character = Math.max(loud, rugged, artistic)
      // If the font is very calm/business and has no expressive character, penalize heavily
      if (calm > 70 && business > 70 && character < 50) {
        score -= 30
      }
      // Boost fonts with strong expressive character
      if (character >= 60) {
        score += character / 5
      }
    } else if (role === 'body') {
      // Body fonts should be readable. Boost Calm, penalize Loud/Awkward
      const calm = entry.expressive['Calm'] || 0
      const awkward = entry.expressive['Awkward'] || 0
      if (calm >= 60) score += calm / 10
      if (awkward >= 50) score -= 10
    }

    if (score > 0) {
      results.push({
        name,
        classification: entry.classification,
        score,
        traits: entry.expressive,
      })
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

/**
 * Format a font shortlist as a concise string for injection into Pass 2 prompt.
 */
export function formatFontShortlist(matches: FontMatch[]): string {
  if (matches.length === 0) return ''

  const lines = matches.map(m => {
    const cls = m.classification.map(c => c.split('/').pop()).join(', ')
    const topTraits = Object.entries(m.traits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t, v]) => `${t}:${v}`)
      .join(' ')
    return `- ${m.name} [${cls}] ${topTraits}`
  })

  return lines.join('\n')
}
