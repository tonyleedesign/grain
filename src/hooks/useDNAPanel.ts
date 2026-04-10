'use client'

import { useCallback, useState, useEffect } from 'react'
import { useEditor, useValue, TLShapeId } from 'tldraw'
import { getBoardIdFromMeta } from '@/lib/board-identity'

export interface ActiveBoard {
  boardId?: string
  boardName: string
  frameShapeId: TLShapeId
}

export interface UseDNAPanelReturn {
  activeBoard: ActiveBoard | null
  panelVisible: boolean
  boardToRender: string | null
  dnaExtracting: boolean
  closePanel: () => void
  setDnaExtracting: (extracting: boolean) => void
  handleExtractDna: () => void
}

export function useDNAPanel(): UseDNAPanelReturn {
  const editor = useEditor()
  const [activeBoard, setActiveBoard] = useState<ActiveBoard | null>(null)
  const [panelVisible, setPanelVisible] = useState(false)
  const [lastBoardName, setLastBoardName] = useState<string | null>(null)
  const [dnaExtracting, setDnaExtracting] = useState(false)

  const boardToRender = activeBoard?.boardName || lastBoardName

  const closePanel = useCallback(() => {
    setPanelVisible(false)
  }, [])

  const handleExtractDna = useCallback(() => {
    const selected = editor.getSelectedShapes()
    const frame = selected.find((s) => s.type === 'frame')
    if (!frame) return
    const name = (frame.props as { name?: string }).name
    if (!name) return

    setActiveBoard({
      boardId: getBoardIdFromMeta(frame),
      boardName: name,
      frameShapeId: frame.id,
    })
    setLastBoardName(name)
    setPanelVisible(true)
  }, [editor])

  const selectedShapes = useValue('selectedShapes', () => editor.getSelectedShapes(), [editor])

  useEffect(() => {
    if (selectedShapes.length === 1 && selectedShapes[0].type === 'frame') {
      const frame = selectedShapes[0]
      const name = (frame.props as { name?: string }).name
      if (name) {
        const animationFrame = window.requestAnimationFrame(() => {
          setActiveBoard({
            boardId: getBoardIdFromMeta(frame),
            boardName: name,
            frameShapeId: frame.id,
          })
          setLastBoardName(name)
          setPanelVisible(true)
        })
        return () => window.cancelAnimationFrame(animationFrame)
      }
    }

    if (selectedShapes.length === 0) {
      const animationFrame = window.requestAnimationFrame(() => {
        setPanelVisible(false)
      })
      return () => window.cancelAnimationFrame(animationFrame)
    }
  }, [selectedShapes])

  return {
    activeBoard,
    panelVisible,
    boardToRender,
    dnaExtracting,
    closePanel,
    setDnaExtracting,
    handleExtractDna,
  }
}
