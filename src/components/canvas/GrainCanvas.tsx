'use client'

// Core canvas component wrapping tldraw with Grain's design tokens.
// Used by both community (/) and private (/canvas) routes.
// Reference: grain-prd.md Section 5.1, 11.2

import { useCallback, useMemo } from 'react'
import { Editor, Tldraw, TLComponents, TLAsset } from 'tldraw'
import 'tldraw/tldraw.css'
import './grain-canvas.css'
import { uploadImages } from '@/lib/uploadImages'
import { CanvasUI } from './CanvasUI'
import { SnapshotCardShapeUtil } from './SnapshotCardShape'
import { AITextShapeUtil } from './AITextShape'
import { GrainBookmarkShapeUtil } from './GrainBookmarkShape'
import { createGrainImageToolbar } from './GrainImageToolbar'
import { createGrainContextMenu } from './GrainContextMenu'
import { GrainMenuPanel } from './GrainMenuPanel'
import { GrainMainMenu } from './GrainMainMenu'
import { GrainPageMenu } from './GrainPageMenu'
import { createGrainToolbar } from './GrainToolbar'
import { useCanvasDocumentSync } from '@/lib/useCanvasDocumentSync'

function dispatchAskAI(anchor?: { x: number; y: number }) {
  window.dispatchEvent(new CustomEvent('grain:ask-ai', { detail: { anchor } }))
}

interface GrainCanvasProps {
  canvasType: 'community' | 'private'
  canvasId: string
  uploadedBy?: string | null
  accessToken?: string | null
}

export function GrainCanvas({ canvasType: _canvasType, canvasId, uploadedBy, accessToken }: GrainCanvasProps) {
  const canvasType = _canvasType
  const customShapeUtils = useMemo(
    () => [SnapshotCardShapeUtil, AITextShapeUtil, GrainBookmarkShapeUtil],
    []
  )
  const { snapshot, hasServerDocument, loading, error, handleMount } = useCanvasDocumentSync({
    canvasId,
    accessToken,
  })

  const components = useMemo<TLComponents>(
    () => ({
      ImageToolbar: createGrainImageToolbar(dispatchAskAI, canvasId),
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

  const onMount = useCallback(
    (editor: Editor) => {
      if (snapshot?.document) {
        editor.loadSnapshot({ document: snapshot.document })
      }

      return handleMount(editor)
    },
    [handleMount, snapshot]
  )

  if (loading) {
    return (
      <div
        className="grain-canvas-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-muted)',
        }}
      >
        Loading canvas...
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="grain-canvas-wrapper"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--destructive)',
        }}
      >
        {error}
      </div>
    )
  }

  return (
    <div className="grain-canvas-wrapper">
      <Tldraw
        shapeUtils={customShapeUtils}
        components={components}
        assets={assets}
        onMount={onMount}
        persistenceKey={hasServerDocument ? undefined : `grain-${canvasType}-${canvasId}`}
        maxAssetSize={50 * 1024 * 1024}
        inferDarkMode={false}
        options={{ actionShortcutsLocation: 'menu' }}
      >
        <CanvasUI canvasId={canvasId} accessToken={accessToken} />
      </Tldraw>
    </div>
  )
}
