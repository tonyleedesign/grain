// Central theme config — all user-visible design tokens live here.
// Never hardcode colors, fonts, radius, or shadows elsewhere.
// Reference: grain-prd.md Section 9.2

export interface GrainTheme {
  colors: {
    bg: string
    surface: string
    accent: string
    text: string
    muted: string
    border: string
  }
  typography: {
    fontFamily: string
    displayFontFamily: string
    fontUrl: string
  }
  radius: {
    sm: string
    md: string
    lg: string
    xl: string
  }
  shadows: {
    toolbar: string
    card: string
    panel: string
    cursor: string
  }
}

export const defaultTheme: GrainTheme = {
  colors: {
    bg:      '#F0EDE8',
    surface: '#FAFAF8',
    accent:  '#6B7F6E',
    text:    '#1A1C19',
    muted:   '#8C8C85',
    border:  '#E2DDD8',
  },
  typography: {
    fontFamily: 'Bricolage Grotesque',
    displayFontFamily: 'Bricolage Grotesque',
    fontUrl: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;500;600&display=swap',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  shadows: {
    toolbar: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
    card:    '0 2px 12px rgba(0,0,0,0.06)',
    panel:   '0 8px 32px rgba(0,0,0,0.10)',
    cursor:  '0 4px 16px rgba(0,0,0,0.08)',
  },
}
