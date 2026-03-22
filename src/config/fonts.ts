// Curated Google Fonts for the theme editor and AI font recommendations.
// Reference: grain-prd.md Section 9.7

export interface CuratedFont {
  name: string
  url: string
  feel: string
}

export const curatedFonts: CuratedFont[] = [
  // Warm & Humanist
  { name: 'Bricolage Grotesque', url: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600&display=swap', feel: 'Warm, quirky, handcrafted' },
  { name: 'DM Sans', url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap', feel: 'Clean, friendly, modern' },
  { name: 'Plus Jakarta Sans', url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500&display=swap', feel: 'Contemporary, versatile' },
  { name: 'Nunito', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500&display=swap', feel: 'Soft, rounded, approachable' },

  // Sharp & Editorial
  { name: 'Geist', url: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&display=swap', feel: 'Crisp, technical, elegant' },
  { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap', feel: 'Neutral, reliable, clean' },
  { name: 'Space Grotesk', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500&display=swap', feel: 'Geometric, editorial' },
  { name: 'Syne', url: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600&display=swap', feel: 'Avant-garde, editorial' },
  { name: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', feel: 'Bold, condensed, strong' },

  // Organic & Expressive
  { name: 'Fraunces', url: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400;500&display=swap', feel: 'Optical, expressive, literary' },
  { name: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap', feel: 'Elegant, high contrast, refined' },
  { name: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&display=swap', feel: 'Delicate, editorial, luxury' },
  { name: 'Unbounded', url: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500&display=swap', feel: 'Wide, futuristic, bold' },
  { name: 'Lexend', url: 'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500&display=swap', feel: 'Readable, open, neutral' },
]
