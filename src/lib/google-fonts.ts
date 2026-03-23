// Dynamic Google Fonts loader — injects <link> tags for AI-recommended fonts.
// More flexible than the existing loadFont() in applyTheme.ts.

export function buildGoogleFontUrl(
  families: Array<{ family: string; weights?: number[] }>
): string {
  const params = families
    .map(({ family, weights }) => {
      const base = `family=${encodeURIComponent(family)}`
      if (weights?.length) {
        return `${base}:wght@${weights.join(';')}`
      }
      return base
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

export function loadGoogleFont(family: string, weights?: number[]): void {
  const url = buildGoogleFontUrl([{ family, weights }])
  const existing = document.querySelector(`link[href="${url}"]`)
  if (!existing) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }
}

export function loadGoogleFonts(
  families: Array<{ family: string; weights?: number[] }>
): void {
  if (!families.length) return
  const url = buildGoogleFontUrl(families)
  const existing = document.querySelector(`link[href="${url}"]`)
  if (!existing) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
  }
}
