import { defaultTheme, GrainTheme } from '@/config/theme'
import { WebAppDNA } from '@/types/dna'
import { buildGoogleFontUrl } from '@/lib/google-fonts'

type RGB = { r: number; g: number; b: number }

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function hexToRgb(hex: string): RGB | null {
  const normalized = hex.replace('#', '').trim()
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: RGB) {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mix(hexA: string, hexB: string, ratio: number) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return hexA

  const t = clamp(ratio, 0, 1)
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const r = channel(rgb.r)
  const g = channel(rgb.g)
  const b = channel(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string) {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function ensureContrast(foreground: string, background: string, fallback: string, minRatio: number) {
  return contrastRatio(foreground, background) >= minRatio ? foreground : fallback
}

function pickRole(dna: WebAppDNA, role: string) {
  return dna.color_palette.colors.find((color) => color.role === role)?.hex
}

function normalizeRadius(radius: number) {
  const value = clamp(radius, 4, 16)
  return {
    sm: `${Math.max(4, Math.round(value * 0.75))}px`,
    md: `${value}px`,
    lg: `${Math.round(value * 1.25)}px`,
    xl: `${Math.round(value * 1.5)}px`,
  }
}

function normalizeShadows(style: WebAppDNA['shadow_style']): GrainTheme['shadows'] {
  switch (style) {
    case 'elevated':
      return {
        toolbar: '0 6px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05)',
        card: '0 4px 18px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        panel: '0 10px 36px rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.05)',
        cursor: '0 4px 16px rgba(0,0,0,0.10)',
      }
    case 'layered':
      return {
        toolbar: '0 5px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)',
        card: '0 3px 14px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.03)',
        panel: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
        cursor: '0 4px 16px rgba(0,0,0,0.08)',
      }
    case 'none':
    case 'subtle':
    default:
      return defaultTheme.shadows
  }
}

export function buildThemeFromWebDna(dna: WebAppDNA): GrainTheme {
  const light = pickRole(dna, 'light') ?? defaultTheme.colors.bg
  const dark = pickRole(dna, 'dark') ?? defaultTheme.colors.text
  const primary = pickRole(dna, 'primary') ?? defaultTheme.colors.accent
  const secondary = pickRole(dna, 'secondary') ?? defaultTheme.colors.border

  const bg = ensureContrast(light, dark, defaultTheme.colors.bg, 4.5) === light
    ? light
    : defaultTheme.colors.bg
  const text = ensureContrast(dark, bg, defaultTheme.colors.text, 7)
  const accent = ensureContrast(primary, bg, defaultTheme.colors.accent, 2.2)

  // Keep clear surface hierarchy even when the board only gives us one light token.
  const surface = contrastRatio(bg, mix(bg, '#ffffff', 0.22)) >= 1.08
    ? mix(bg, '#ffffff', 0.22)
    : mix(bg, text, 0.04)

  const borderCandidate = mix(secondary, text, 0.18)
  const border = contrastRatio(borderCandidate, bg) >= 1.2
    ? borderCandidate
    : mix(text, bg, 0.82)

  const mutedCandidate = mix(text, bg, 0.58)
  const muted = contrastRatio(mutedCandidate, bg) >= 2.6
    ? mutedCandidate
    : defaultTheme.colors.muted

  const bodyFont = dna.typography.body
  const displayFont = dna.typography.display

  return {
    colors: {
      bg,
      surface,
      accent,
      text,
      muted,
      border,
    },
    typography: {
      // Use body font globally for app readability; still load display for previews and future use.
      fontFamily: bodyFont.family,
      displayFontFamily: displayFont.family,
      fontUrl: buildGoogleFontUrl([
        { family: bodyFont.family, weights: [bodyFont.weight] },
        { family: displayFont.family, weights: [displayFont.weight] },
      ]),
    },
    radius: normalizeRadius(dna.border_radius),
    shadows: normalizeShadows(dna.shadow_style),
  }
}
