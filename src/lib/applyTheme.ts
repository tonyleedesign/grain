// Applies a GrainTheme to :root CSS custom properties.
// Reference: grain-prd.md Section 9.3

import { GrainTheme } from '@/config/theme'

export function applyTheme(theme: GrainTheme) {
  const root = document.documentElement

  // Colors
  root.style.setProperty('--color-bg',      theme.colors.bg)
  root.style.setProperty('--color-surface',  theme.colors.surface)
  root.style.setProperty('--color-accent',   theme.colors.accent)
  root.style.setProperty('--color-text',     theme.colors.text)
  root.style.setProperty('--color-muted',    theme.colors.muted)
  root.style.setProperty('--color-border',   theme.colors.border)

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
