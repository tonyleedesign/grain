// Parses Google Fonts families.csv into a compact JSON index for font matching.
// Run: npx tsx scripts/build-font-index.ts
// Output: src/data/font-index.json

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const CSV_PATH = join(__dirname, 'families.csv')
const OUT_DIR = join(__dirname, '..', 'src', 'data')
const OUT_PATH = join(OUT_DIR, 'font-index.json')

// Tags we care about for design DNA matching — skip seasonal, special use, quality
const RELEVANT_PREFIXES = ['/Sans/', '/Serif/', '/Slab/', '/Monospace/', '/Script/', '/Theme/', '/Expressive/']

interface FontEntry {
  classification: string[]      // e.g. ["/Sans/Geometric"]
  expressive: Record<string, number>  // e.g. { "Rugged": 65, "Vintage": 40 }
  themes: string[]              // e.g. ["Stencil", "Art Deco"]
}

const raw = readFileSync(CSV_PATH, 'utf-8')
const lines = raw.trim().split('\n')

const fonts: Record<string, FontEntry> = {}

for (const line of lines) {
  // Format: fontName,,tagPath,score
  const parts = line.split(',')
  const name = parts[0]
  const tag = parts[2]
  const score = parseInt(parts[3], 10)

  if (!name || !tag || isNaN(score)) continue
  if (!RELEVANT_PREFIXES.some(p => tag.startsWith(p))) continue

  // Skip low-confidence tags
  if (score < 20) continue

  if (!fonts[name]) {
    fonts[name] = { classification: [], expressive: {}, themes: [] }
  }

  const entry = fonts[name]

  if (tag.startsWith('/Sans/') || tag.startsWith('/Serif/') || tag.startsWith('/Slab/') || tag.startsWith('/Monospace/') || tag.startsWith('/Script/')) {
    // Only include if score >= 50 (meaningful classification)
    if (score >= 50) {
      entry.classification.push(tag)
    }
  } else if (tag.startsWith('/Expressive/')) {
    const trait = tag.replace('/Expressive/', '')
    entry.expressive[trait] = score
  } else if (tag.startsWith('/Theme/')) {
    const theme = tag.replace('/Theme/', '')
    if (score >= 40) {
      entry.themes.push(theme)
    }
  }
}

// Remove fonts with no meaningful classification
const filtered: Record<string, FontEntry> = {}
for (const [name, entry] of Object.entries(fonts)) {
  if (entry.classification.length > 0) {
    filtered[name] = entry
  }
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(filtered, null, 2))

console.log(`Built font index: ${Object.keys(filtered).length} fonts → ${OUT_PATH}`)
