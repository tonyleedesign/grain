'use client'

// Theme state lives in React context so any component can read it
// and the whole app reacts instantly when it changes.
// Reference: grain-prd.md Section 9.4

import { createContext, useContext, useState } from 'react'
import { GrainTheme, defaultTheme } from '@/config/theme'
import { applyTheme } from '@/lib/applyTheme'

interface ThemeContextType {
  theme: GrainTheme
  setTheme: (theme: GrainTheme) => void
  resetTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<GrainTheme>(defaultTheme)

  const setTheme = (newTheme: GrainTheme) => {
    applyTheme(newTheme)
    setThemeState(newTheme)
  }

  const resetTheme = () => {
    applyTheme(defaultTheme)
    setThemeState(defaultTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
