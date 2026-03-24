// Extracts mood and classification signals from Pass 1 observation text
// to drive font shortlist generation. Uses simple keyword matching.

const MOOD_KEYWORDS: Record<string, string[]> = {
  warm: ['warm', 'amber', 'golden', 'cozy', 'inviting', 'earthy', 'terracotta', 'honey', 'copper'],
  cool: ['cool', 'cold', 'icy', 'steel', 'slate', 'silver', 'clinical', 'muted', 'detach', 'stoic'],
  raw: ['raw', 'rough', 'grain', 'grit', 'texture', 'unpolished', 'analog', 'film', 'noise', 'imperfect', 'artifact', 'asphalt', 'print artifact', 'faux-print'],
  polished: ['polished', 'clean', 'smooth', 'glossy', 'refined', 'pristine', 'sleek'],
  vintage: ['vintage', 'retro', 'aged', 'faded', 'nostalgic', 'film stock', 'analog', 'scan'],
  futuristic: ['futuristic', 'neon', 'digital', 'cyber', 'tech', 'synthetic', 'holographic'],
  playful: ['playful', 'fun', 'bright', 'colorful', 'whimsical', 'bouncy', 'cheerful'],
  serious: ['serious', 'somber', 'dark', 'heavy', 'austere', 'stern', 'stoic', 'tension', 'confrontational', 'detach'],
  rugged: ['rugged', 'industrial', 'concrete', 'metal', 'worn', 'weathered', 'brutalist', 'asphalt', 'grit'],
  sophisticated: ['sophisticated', 'elegant', 'luxury', 'refined', 'haute', 'couture'],
  loud: ['loud', 'bold', 'striking', 'aggressive', 'intense', 'dramatic', 'confrontational', 'intervention', 'maximum'],
  quiet: ['quiet', 'subtle', 'muted', 'soft', 'gentle', 'understated', 'minimal'],
  editorial: ['editorial', 'magazine', 'fashion', 'layout', 'typographic', 'print', 'graphic', 'zine', 'crop window', 'overlay'],
  brutalist: ['brutalist', 'stark', 'hard', 'angular', 'blocky', 'monolithic', 'intervention'],
  artistic: ['artistic', 'expressive', 'painterly', 'abstract', 'creative'],
  industrial: ['industrial', 'factory', 'mechanical', 'utilitarian', 'functional', 'asphalt', 'concrete'],
  organic: ['organic', 'natural', 'flowing', 'hand', 'irregular', 'human'],
  geometric: ['geometric', 'grid', 'precise', 'mathematical', 'angular', 'structured'],
}

const CLASSIFICATION_KEYWORDS: Record<string, string[]> = {
  'geometric-sans': ['geometric', 'uniform', 'precise', 'no stroke contrast', 'uniform weight'],
  'humanist-sans': ['humanist', 'organic', 'readable', 'friendly', 'rounded'],
  'neo-grotesque': ['grotesque', 'neutral', 'industrial', 'utilitarian', 'squared'],
  'grotesque': ['condensed', 'narrow', 'compressed', 'tall', 'display type', 'outlined', 'headline'],
  'mono': ['mono', 'monospace', 'code', 'technical', 'typewriter', 'mechanical', 'tightly tracked'],
  'didone': ['high contrast', 'thin strokes', 'hairline', 'fashion', 'elegant', 'didone', 'editorial'],
  'transitional-serif': ['serif', 'traditional', 'classic', 'book', 'readable'],
  'slab': ['slab', 'thick serif', 'heavy', 'sturdy', 'mechanical', 'squared-off'],
  'display': ['display', 'headline', 'large', 'expressive', 'outlined', 'intervention', 'graphic', 'bold type', 'large scale'],
}

/**
 * Extract mood and classification signals from observation text.
 */
export function extractSignals(observations: string): {
  moods: string[]
  classifications: string[]
} {
  const text = observations.toLowerCase()
  const moods: string[] = []
  const classifications: string[] = []

  // Score each mood by keyword hits
  const moodScores: Record<string, number> = {}
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      // Count occurrences — more hits = stronger signal
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
      const matches = text.match(regex)
      if (matches) hits += matches.length
    }
    if (hits > 0) moodScores[mood] = hits
  }

  // Take top 4 moods by hit count
  const sortedMoods = Object.entries(moodScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
  for (const [mood] of sortedMoods) {
    moods.push(mood)
  }

  // Score each classification
  const classScores: Record<string, number> = {}
  for (const [cls, keywords] of Object.entries(CLASSIFICATION_KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
      const matches = text.match(regex)
      if (matches) hits += matches.length
    }
    if (hits > 0) classScores[cls] = hits
  }

  // Take top 3 classifications
  const sortedClass = Object.entries(classScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
  for (const [cls] of sortedClass) {
    classifications.push(cls)
  }

  // Default fallback — if no classification signals, include broad categories
  if (classifications.length === 0) {
    classifications.push('geometric-sans', 'humanist-sans', 'neo-grotesque')
  }

  return { moods, classifications }
}
