import { extractSignals } from '@/lib/observation-signals'
import { matchFonts, formatFontShortlist } from '@/lib/font-matcher'

// Simulated Cold Eye Zine observations
const observations = `
Graphic-composite portrait with outlined display type, a sharp-eye crop window, and faux-print artifacts — design intervention at maximum, image as material.
Overhead shot on dark asphalt, heavy film grain, upward stare — pure photographic tension with zero graphic layering, the image IS the design.
Faded warm color scan, cluttered kitchen, the only saturated note is a single red lip — texture and environmental grit over graphic cleanliness.

Direct or upward gaze, dark hair on pale skin, black clothing as default, cool-to-muted temperature throughout, studied detachment with no warmth or approachability anywhere, grain/texture as a constant surface quality.

Image one is heavily designed with graphic overlays; image two is a clean photographic frame; image three adds color and clutter. Muted cool dominates but image three pulls warm and busy. Design intervention ranges from maximal to zero.
`

const signals = extractSignals(observations)
console.log('Extracted signals:', signals)

console.log('\n=== DISPLAY CANDIDATES ===')
const displayFonts = matchFonts({
  classifications: [...signals.classifications, 'display'],
  moods: signals.moods,
  role: 'display',
  limit: 20,
})
console.log(formatFontShortlist(displayFonts))

console.log('\n=== BODY CANDIDATES ===')
const bodyFonts = matchFonts({
  classifications: ['humanist-sans', 'neo-grotesque', 'transitional-serif', 'mono'],
  moods: signals.moods,
  role: 'body',
  limit: 15,
})
console.log(formatFontShortlist(bodyFonts))
