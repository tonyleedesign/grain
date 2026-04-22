import { chromeApi } from '../chrome-api.js'
import type { ElementSelectionResult, ScreenshotCaptureResult } from './types.js'

async function selectElementOnPage(tabId: number): Promise<ElementSelectionResult | null> {
  const [result] = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: async () => {
      return await new Promise<ElementSelectionResult | null>((resolve) => {
        const overlay = document.createElement('div')
        overlay.style.position = 'fixed'
        overlay.style.inset = '0'
        overlay.style.zIndex = '2147483647'
        overlay.style.pointerEvents = 'none'
        overlay.style.background = 'rgba(36, 29, 22, 0.08)'

        const outline = document.createElement('div')
        outline.style.position = 'fixed'
        outline.style.border = '2px solid #2f6f57'
        outline.style.background = 'rgba(47, 111, 87, 0.12)'
        outline.style.boxSizing = 'border-box'
        outline.style.pointerEvents = 'none'

        const badge = document.createElement('div')
        badge.textContent = 'Click an element to capture. Press Esc to cancel.'
        badge.style.position = 'fixed'
        badge.style.top = '12px'
        badge.style.left = '50%'
        badge.style.transform = 'translateX(-50%)'
        badge.style.padding = '8px 12px'
        badge.style.borderRadius = '999px'
        badge.style.background = '#241d16'
        badge.style.color = '#fff'
        badge.style.font = '12px system-ui, sans-serif'
        badge.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)'
        badge.style.pointerEvents = 'none'

        overlay.append(outline, badge)
        document.documentElement.appendChild(overlay)

        let hovered: Element | null = null

        const settleAfterCleanup = async () => {
          await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()))
          await new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame()))
          await new Promise<void>((resolveTimer) => setTimeout(resolveTimer, 40))
        }

        const cleanup = () => {
          overlay.remove()
          document.removeEventListener('mousemove', handleMouseMove, true)
          document.removeEventListener('click', handleClick, true)
          document.removeEventListener('keydown', handleKeyDown, true)
        }

        const updateOutline = (element: Element | null) => {
          hovered = element
          if (!element || !(element instanceof HTMLElement)) {
            outline.style.width = '0'
            outline.style.height = '0'
            return
          }

          const rect = element.getBoundingClientRect()
          outline.style.left = `${rect.left}px`
          outline.style.top = `${rect.top}px`
          outline.style.width = `${rect.width}px`
          outline.style.height = `${rect.height}px`
        }

        const handleMouseMove = (event: MouseEvent) => {
          const next = document.elementFromPoint(event.clientX, event.clientY)
          if (!next || next === document.documentElement || next === document.body) {
            updateOutline(null)
            return
          }
          updateOutline(next)
        }

        const handleClick = async (event: MouseEvent) => {
          event.preventDefault()
          event.stopPropagation()

          const target = hovered instanceof HTMLElement ? hovered : null
          if (!target) {
            cleanup()
            await settleAfterCleanup()
            resolve(null)
            return
          }

          const rect = target.getBoundingClientRect()
          cleanup()
          await settleAfterCleanup()
          resolve({
            rect: {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            },
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
            tagName: target.tagName.toLowerCase(),
          })
        }

        const handleKeyDown = async (event: KeyboardEvent) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          cleanup()
          await settleAfterCleanup()
          resolve(null)
        }

        document.addEventListener('mousemove', handleMouseMove, true)
        document.addEventListener('click', handleClick, true)
        document.addEventListener('keydown', handleKeyDown, true)
      })
    },
  })

  return result?.result ?? null
}

async function cropCapturedDataUrl(dataUrl: string, selection: ElementSelectionResult): Promise<string> {
  const blob = await fetch(dataUrl).then((response) => response.blob())
  const bitmap = await createImageBitmap(blob)

  try {
    const scaleX = bitmap.width / Math.max(selection.viewport.width, 1)
    const scaleY = bitmap.height / Math.max(selection.viewport.height, 1)
    const cropLeft = Math.max(0, Math.floor(selection.rect.left * scaleX))
    const cropTop = Math.max(0, Math.floor(selection.rect.top * scaleY))
    const cropWidth = Math.max(1, Math.min(bitmap.width - cropLeft, Math.ceil(selection.rect.width * scaleX)))
    const cropHeight = Math.max(1, Math.min(bitmap.height - cropTop, Math.ceil(selection.rect.height * scaleY)))

    const canvas = new OffscreenCanvas(cropWidth, cropHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to initialize crop canvas')
    }

    ctx.drawImage(
      bitmap,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    )

    const croppedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read cropped screenshot'))
      reader.readAsDataURL(croppedBlob)
    })
  } finally {
    bitmap.close()
  }
}

export async function captureElementScreenshot(tabId: number): Promise<ScreenshotCaptureResult> {
  const selection = await selectElementOnPage(tabId)
  if (!selection) {
    throw new Error('Element capture cancelled')
  }

  const visibleDataUrl = await chromeApi.tabs.captureVisibleTab(null, {
    format: 'jpeg',
    quality: 92,
  })
  const dataUrl = await cropCapturedDataUrl(visibleDataUrl, selection)

  return {
    dataUrl,
    metadata: {
      captureMode: 'element',
      elementTagName: selection.tagName,
      elementWidth: Math.round(selection.rect.width),
      elementHeight: Math.round(selection.rect.height),
      viewportWidth: selection.viewport.width,
      viewportHeight: selection.viewport.height,
    },
  }
}
