/**
 * Converts DNA color tokens into a shadcn/ui CSS variables block.
 * Maps DNA semantic roles (primary, secondary, accent, dark, light)
 * to shadcn semantic slots (primary, secondary, accent, muted, background, foreground, etc.)
 */

interface DNAColor {
  hex: string
  role: string
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  // Handle 3-char shorthand (#FFF → FFFFFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  if (hex.length !== 6) return { h: 0, s: 0, l: 50 } // fallback for invalid input
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(h * 360 * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  }
}

function hslString(hsl: { h: number; s: number; l: number }): string {
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`
}

function lighten(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: hsl.s, l: Math.min(100, hsl.l + amount) }
}

function darken(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: hsl.s, l: Math.max(0, hsl.l - amount) }
}

function desaturate(hsl: { h: number; s: number; l: number }, amount: number) {
  return { h: hsl.h, s: Math.max(0, hsl.s - amount), l: hsl.l }
}

export function generateShadcnTheme(
  colors: DNAColor[],
  borderRadius: number
): string {
  // Map DNA roles to colors
  const primary = colors.find(c => c.role === 'primary')
  const secondary = colors.find(c => c.role === 'secondary')
  const accent = colors.find(c => c.role === 'accent')
  const dark = colors.find(c => c.role === 'dark')
  const light = colors.find(c => c.role === 'light')

  // Fallbacks
  const primaryHSL = primary ? hexToHSL(primary.hex) : { h: 0, s: 0, l: 20 }
  const secondaryHSL = secondary ? hexToHSL(secondary.hex) : desaturate(lighten(primaryHSL, 40), 30)
  const accentHSL = accent ? hexToHSL(accent.hex) : { h: (primaryHSL.h + 30) % 360, s: primaryHSL.s, l: primaryHSL.l }
  const darkHSL = dark ? hexToHSL(dark.hex) : darken(primaryHSL, 60)
  const lightHSL = light ? hexToHSL(light.hex) : { h: primaryHSL.h, s: Math.min(primaryHSL.s, 10), l: 98 }

  // Radius mapping
  const radiusRem = borderRadius <= 0 ? '0' :
                    borderRadius <= 4 ? '0.25rem' :
                    borderRadius <= 8 ? '0.5rem' :
                    borderRadius <= 12 ? '0.625rem' :
                    borderRadius <= 16 ? '0.75rem' :
                    borderRadius <= 20 ? '1rem' : '1.25rem'

  const lines = [
    ':root {',
    `  --background: ${hslString(lightHSL)};`,
    `  --foreground: ${hslString(darkHSL)};`,
    `  --card: ${hslString(lighten(lightHSL, 1))};`,
    `  --card-foreground: ${hslString(darkHSL)};`,
    `  --popover: ${hslString(lightHSL)};`,
    `  --popover-foreground: ${hslString(darkHSL)};`,
    `  --primary: ${hslString(primaryHSL)};`,
    `  --primary-foreground: ${hslString(primaryHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --secondary: ${hslString(secondaryHSL)};`,
    `  --secondary-foreground: ${hslString(secondaryHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --muted: ${hslString(desaturate(lighten(primaryHSL, 35), 25))};`,
    `  --muted-foreground: ${hslString(desaturate(primaryHSL, 20))};`,
    `  --accent: ${hslString(accentHSL)};`,
    `  --accent-foreground: ${hslString(accentHSL.l > 50 ? darkHSL : lightHSL)};`,
    `  --destructive: 0 84.2% 60.2%;`,
    `  --destructive-foreground: 0 0% 98%;`,
    `  --border: ${hslString(desaturate(lighten(primaryHSL, 30), 20))};`,
    `  --input: ${hslString(desaturate(lighten(primaryHSL, 30), 20))};`,
    `  --ring: ${hslString(primaryHSL)};`,
    `  --radius: ${radiusRem};`,
    '}',
  ]

  return lines.join('\n')
}
