import { matchFonts, formatFontShortlist } from '@/lib/font-matcher'

console.log('=== DISPLAY (raw, industrial, grotesque) ===')
const display = matchFonts({
  classifications: ['grotesque', 'neo-grotesque', 'display'],
  moods: ['raw', 'industrial', 'brutalist'],
  limit: 15,
})
console.log(formatFontShortlist(display))

console.log('')
console.log('=== BODY (mono, futuristic, raw) ===')
const body = matchFonts({
  classifications: ['mono'],
  moods: ['raw', 'futuristic', 'industrial'],
  limit: 10,
})
console.log(formatFontShortlist(body))

console.log('')
console.log('=== EDITORIAL WARM (humanist, serif, warm, sophisticated) ===')
const editorial = matchFonts({
  classifications: ['humanist-sans', 'transitional-serif', 'didone'],
  moods: ['warm', 'sophisticated', 'editorial'],
  limit: 15,
})
console.log(formatFontShortlist(editorial))
