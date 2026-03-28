// Applies a GrainTheme to :root CSS custom properties.
// Reference: grain-prd.md Section 9.3

import { GrainTheme } from '@/config/theme'

function hexToRgb(hex: string) {
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

function pickForegroundForAccent(accent: string, text: string, surface: string) {
  return contrastRatio(text, accent) >= contrastRatio(surface, accent) ? text : surface
}

export function applyTheme(theme: GrainTheme) {
  const root = document.documentElement
  const primaryForeground = pickForegroundForAccent(
    theme.colors.accent,
    theme.colors.text,
    theme.colors.surface
  )

  // Colors
  root.style.setProperty('--color-bg',      theme.colors.bg)
  root.style.setProperty('--color-surface',  theme.colors.surface)
  root.style.setProperty('--color-accent',   theme.colors.accent)
  root.style.setProperty('--color-text',     theme.colors.text)
  root.style.setProperty('--color-muted',    theme.colors.muted)
  root.style.setProperty('--color-border',   theme.colors.border)
  root.style.setProperty('--primary-foreground', primaryForeground)
  root.style.setProperty('--sidebar-primary-foreground', primaryForeground)

  // Typography
  root.style.setProperty('--font-family', theme.typography.fontFamily)
  root.style.setProperty('--font-display', theme.typography.displayFontFamily)
  loadFont(theme.typography.fontUrl)

  // Radius
  root.style.setProperty('--radius-sm', theme.radius.sm)
  root.style.setProperty('--radius-md', theme.radius.md)
  root.style.setProperty('--radius-lg', theme.radius.lg)
  root.style.setProperty('--radius-xl', theme.radius.xl)

  // Shadows
  root.style.setProperty('--shadow-toolbar', theme.shadows.toolbar)
  root.style.setProperty('--shadow-card',    theme.shadows.card)
  root.style.setProperty('--shadow-panel',   theme.shadows.panel)
  root.style.setProperty('--shadow-cursor',  theme.shadows.cursor)
}

function loadFont(url: string) {
  const existing = document.querySelector(`link[href="${url}"]`)
  if (!existing) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }
}
