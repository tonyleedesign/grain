'use client'

import type { DesignMD } from '@/types/dna'
import { buildThemeFromDesignMd } from '@/lib/themeFromDna'
import { TokensPanel } from '../fields/TokensPanel'
import { ReasoningField } from '../fields/ReasoningField'
import { PatternEvidenceField } from '../fields/PatternEvidenceField'
import { ThemePreview } from '../fields/ThemePreview'

function Divider() {
  return <hr className="my-5 border-t border-(--color-border)" />
}

export function DesignMDDesignerView({ dna, imageUrls }: { dna: DesignMD; imageUrls: string[] }) {
  const theme = buildThemeFromDesignMd(dna)

  return (
    <div className="flex flex-col">
      {dna.reasoning && typeof dna.reasoning === 'object' && Array.isArray((dna.reasoning as { per_image?: unknown }).per_image) && (
        <>
          <ReasoningField reasoning={dna.reasoning} />
          <Divider />
        </>
      )}

      <TokensPanel tokens={dna.tokens} />

      <Divider />
      <ThemePreview theme={theme} />

      {dna.evidence && dna.evidence.length > 0 && (
        <>
          <Divider />
          <PatternEvidenceField evidence={dna.evidence} imageUrls={imageUrls} />
        </>
      )}
    </div>
  )
}
