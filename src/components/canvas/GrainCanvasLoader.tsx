'use client'

// Dynamic loader for GrainCanvas — prevents tldraw from running during SSR.
// tldraw requires browser APIs (window, document) that don't exist server-side.

import dynamic from 'next/dynamic'

const GrainCanvas = dynamic(
  () => import('./GrainCanvas').then((mod) => mod.GrainCanvas),
  { ssr: false }
)

interface GrainCanvasLoaderProps {
  canvasType: 'community' | 'private'
  canvasId: string
  uploadedBy?: string | null
  accessToken?: string | null
}

export function GrainCanvasLoader(props: GrainCanvasLoaderProps) {
  return <GrainCanvas {...props} />
}
