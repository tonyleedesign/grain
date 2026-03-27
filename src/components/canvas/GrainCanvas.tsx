'use client'

// Core canvas component wrapping tldraw with Grain's design tokens.
// Used by both community (/) and private (/canvas) routes.
// Reference: grain-prd.md Section 5.1, 11.2

import { useMemo } from 'react'
import { Tldraw, TLComponents, TLAsset } from 'tldraw'
import 'tldraw/tldraw.css'
import './grain-canvas.css'
import { uploadImages } from '@/lib/uploadImages'
import { CanvasUI } from './CanvasUI'
import { SnapshotCardShapeUtil } from './SnapshotCardShape'
import { AITextShapeUtil } from './AITextShape'
import { createGrainImageToolbar } from './GrainImageToolbar'
import { createGrainContextMenu } from './GrainContextMenu'
import { GrainMenuPanel } from './GrainMenuPanel'
import { GrainMainMenu } from './GrainMainMenu'
import { GrainPageMenu } from './GrainPageMenu'
import { createGrainToolbar } from './GrainToolbar'

function dispatchAskAI() {
  window.dispatchEvent(new Event('grain:ask-ai'))
}

interface GrainCanvasProps {
  canvasType: 'community' | 'private'
  canvasId: string
  uploadedBy?: string | null
}

export function GrainCanvas({ canvasType, canvasId, uploadedBy }: GrainCanvasProps) {
  const customShapeUtils = useMemo(() => [SnapshotCardShapeUtil, AITextShapeUtil], [])

  const components = useMemo<TLComponents>(
    () => ({
      ImageToolbar: createGrainImageToolbar(dispatchAskAI),
      ContextMenu: createGrainContextMenu(dispatchAskAI),
      MenuPanel: GrainMenuPanel,
      MainMenu: GrainMainMenu,
      PageMenu: GrainPageMenu,
      Toolbar: createGrainToolbar(canvasId),
    }),
    [canvasId]
  )

  // Custom asset store — routes image uploads through Grain's pipeline
  // (HEIC conversion → Sharp resize → Supabase Storage)
  const assets = useMemo(
    () => ({
      async upload(asset: TLAsset, file: File): Promise<{ src: string }> {
        const [result] = await uploadImages([file], {
          canvasId,
          uploadedBy,
        })
        return { src: result.url }
      },
    }),
    [canvasId, uploadedBy]
  )

  return (
    <div className="grain-canvas-wrapper">
      <Tldraw
        shapeUtils={customShapeUtils}
        components={components}
        assets={assets}
        maxAssetSize={50 * 1024 * 1024}
        inferDarkMode={false}
        options={{ actionShortcutsLocation: 'menu' }}
        persistenceKey={`grain-${canvasType}-${canvasId}`}
      >
        <CanvasUI canvasId={canvasId} />
      </Tldraw>
    </div>
  )
}
