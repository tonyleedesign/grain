'use client'

// Discriminated renderer — picks the correct layout based on medium.

import { Medium, WebAppDNA, ImageGenDNA } from '@/types/dna'
import { WebAppDesignerView } from './layouts/WebAppDesignerView'
import { ImageGenDesignerView } from './layouts/ImageGenDesignerView'

interface DesignerViewProps {
  medium: Medium
  dna: WebAppDNA | ImageGenDNA
  imageUrls: string[]
}

export function DesignerView({ medium, dna, imageUrls }: DesignerViewProps) {
  if (medium === 'web') {
    return <WebAppDesignerView dna={dna as WebAppDNA} imageUrls={imageUrls} />
  }
  return <ImageGenDesignerView dna={dna as ImageGenDNA} imageUrls={imageUrls} />
}
