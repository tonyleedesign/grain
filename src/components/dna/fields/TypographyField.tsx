'use client'

import { useEffect } from 'react'
import { loadGoogleFont } from '@/lib/google-fonts'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1.5">
      {children}
    </div>
  )
}

interface FontInfo {
  family: string
  weight: number
  classification: string
}

interface TypographyFieldProps {
  display: FontInfo
  body: FontInfo
}

export function TypographyField({ display, body }: TypographyFieldProps) {
  useEffect(() => {
    loadGoogleFont(display.family, [display.weight])
    loadGoogleFont(body.family, [body.weight])
  }, [display.family, display.weight, body.family, body.weight])

  return (
    <div>
      <SectionLabel>Typography</SectionLabel>
      <div className="flex flex-col gap-3">
        <div>
          <div
            style={{
              fontFamily: `'${display.family}', sans-serif`,
              fontWeight: display.weight,
              fontSize: 28,
              lineHeight: 1.2,
              color: 'var(--color-text)',
            }}
          >
            Display Heading
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {display.family} {display.weight}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: `'${body.family}', sans-serif`,
              fontWeight: body.weight,
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--color-text)',
            }}
          >
            Body text preview paragraph
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {body.family} {body.weight}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: `'${body.family}', sans-serif`,
              fontWeight: body.weight,
              fontSize: 12,
              lineHeight: 1.4,
              color: 'var(--color-text)',
            }}
          >
            Caption text
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {body.family} {body.weight}
          </div>
        </div>
      </div>
    </div>
  )
}
