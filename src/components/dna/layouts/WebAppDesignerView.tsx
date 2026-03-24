'use client'

import { WebAppDNA } from '@/types/dna'
import { ReasoningField } from '../fields/ReasoningField'
import { ColorPaletteField } from '../fields/ColorPaletteField'
import { TypographyField } from '../fields/TypographyField'
import { BorderRadiusField } from '../fields/BorderRadiusField'
import { SpacingDensityField } from '../fields/SpacingDensityField'
import { ShadowStyleField } from '../fields/ShadowStyleField'
import { WebTextureField } from '../fields/WebTextureField'
import { MotionField } from '../fields/MotionField'
import { ImageTreatmentField } from '../fields/ImageTreatmentField'
import { AntiPatternsField } from '../fields/AntiPatternsField'
import { MoodTagsField } from '../fields/MoodTagsField'
import { PatternEvidenceField } from '../fields/PatternEvidenceField'

function Divider() {
  return <hr className="my-6 border-t border-(--color-border)" />
}

interface WebAppDesignerViewProps {
  dna: WebAppDNA
  imageUrls: string[]
}

export function WebAppDesignerView({ dna, imageUrls }: WebAppDesignerViewProps) {
  return (
    <div className="flex flex-col">
      {/* AI Reasoning — collapsed by default */}
      {dna.reasoning && <ReasoningField reasoning={dna.reasoning} />}

      {/* Direction summary */}
      <p className="text-[13px] italic leading-snug" style={{ color: 'var(--color-text)' }}>
        {dna.direction_summary}
      </p>

      <Divider />

      <ColorPaletteField
        variant="web"
        colors={dna.color_palette.colors}
        overlays={dna.color_palette.overlays}
        relationship={dna.color_palette.relationship}
      />

      <Divider />

      <TypographyField
        display={dna.typography.display}
        body={dna.typography.body}
      />

      <Divider />

      <BorderRadiusField radius={dna.border_radius} />

      <Divider />

      <SpacingDensityField density={dna.spacing_density} />

      <Divider />

      <ShadowStyleField style={dna.shadow_style} />

      {dna.texture && (
        <>
          <Divider />
          <WebTextureField texture={dna.texture} />
        </>
      )}

      {dna.motion && (
        <>
          <Divider />
          <MotionField motion={dna.motion} />
        </>
      )}

      {dna.image_treatment && (
        <>
          <Divider />
          <ImageTreatmentField imageTreatment={dna.image_treatment} />
        </>
      )}

      <Divider />

      <AntiPatternsField antiPatterns={dna.anti_patterns} />

      <Divider />

      <MoodTagsField tags={dna.mood_tags} />

      <Divider />

      <PatternEvidenceField
        evidence={dna.evidence}
        imageUrls={imageUrls}
      />
    </div>
  )
}
