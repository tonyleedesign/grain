'use client'

// Discriminated renderer — picks the correct layout based on medium.

import { Medium, WebAppDNA, ImageGenDNA, DesignMD } from '@/types/dna'
import { WebAppDesignerView } from './layouts/WebAppDesignerView'
import { ImageGenDesignerView } from './layouts/ImageGenDesignerView'
import { DesignMDDesignerView } from './layouts/DesignMDDesignerView'

interface DesignerViewProps {
  medium: Medium
  dna: WebAppDNA | ImageGenDNA | DesignMD
  dnaVersion?: string | null
  imageUrls: string[]
}

export function DesignerView({ medium, dna, dnaVersion, imageUrls }: DesignerViewProps) {
  if (medium === 'image') {
    return <ImageGenDesignerView dna={dna as ImageGenDNA} imageUrls={imageUrls} />
  }
  if (dnaVersion === 'design-md-v1') {
    return <DesignMDDesignerView dna={dna as DesignMD} imageUrls={imageUrls} />
  }
  if (medium === 'web') {
    return <WebAppDesignerView dna={dna as WebAppDNA} imageUrls={imageUrls} />
  }
  return null
}
