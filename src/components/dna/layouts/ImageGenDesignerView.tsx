'use client'

import { ImageGenDNA } from '@/types/dna'
import { ColorPaletteField } from '../fields/ColorPaletteField'
import { MediumTypeField } from '../fields/MediumTypeField'
import { LightingField } from '../fields/LightingField'
import { TextureField } from '../fields/TextureField'
import { CompositionField } from '../fields/CompositionField'
import { EraMovementField } from '../fields/EraMovementField'
import { AntiPatternsField } from '../fields/AntiPatternsField'
import { MoodTagsField } from '../fields/MoodTagsField'
import { PatternEvidenceField } from '../fields/PatternEvidenceField'

function Divider() {
  return <hr className="my-6 border-t border-(--color-border)" />
}

interface ImageGenDesignerViewProps {
  dna: ImageGenDNA
  imageUrls: string[]
}

export function ImageGenDesignerView({ dna, imageUrls }: ImageGenDesignerViewProps) {
  return (
    <div className="flex flex-col">
      {/* Direction summary */}
      <p className="text-[13px] italic leading-snug" style={{ color: 'var(--color-text)' }}>
        {dna.direction_summary}
      </p>

      <Divider />

      <ColorPaletteField
        variant="image"
        colors={dna.color_palette.colors}
        mood={dna.color_palette.mood}
      />

      <Divider />

      <MediumTypeField
        primary={dna.medium_type.primary}
        subTags={dna.medium_type.sub_tags}
      />

      <Divider />

      <LightingField lighting={dna.lighting} />

      <Divider />

      <TextureField
        level={dna.texture.level}
        keywords={dna.texture.keywords}
      />

      <Divider />

      <CompositionField
        style={dna.composition.style}
        description={dna.composition.description}
      />

      <Divider />

      <EraMovementField eraMovement={dna.era_movement} />

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
