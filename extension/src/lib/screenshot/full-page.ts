import { chromeApi } from '../chrome-api.js'
import type { ScreenshotCaptureResult } from './types.js'

export async function captureFullPageScreenshot(tabId: number): Promise<ScreenshotCaptureResult> {
  const [result] = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: async () => {
      // Runs in the page context. Requests visible-frame captures from the
      // extension service worker and stitches them into one image.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cr = ((globalThis as any).browser ?? (globalThis as any).chrome) as {
        runtime: {
          sendMessage(
            msg: object,
            callback: (resp: { type: string; dataUrl?: string; error?: string }) => void
          ): void
          lastError?: { message?: string }
        }
      }

      const doc = document.documentElement
      const body = document.body
      const viewportW = window.innerWidth
      const viewportH = window.innerHeight
      const pageW = Math.max(
        doc.scrollWidth,
        doc.clientWidth,
        body?.scrollWidth ?? 0,
        body?.clientWidth ?? 0,
        viewportW
      )
      const pageH = Math.max(
        doc.scrollHeight,
        doc.clientHeight,
        body?.scrollHeight ?? 0,
        body?.clientHeight ?? 0,
        viewportH
      )
      const maxScrollY = Math.max(0, pageH - viewportH)
      const scrollTargets: number[] = []

      for (let y = 0; y < maxScrollY; y += viewportH) {
        scrollTargets.push(y)
      }
      scrollTargets.push(maxScrollY)

      const uniqueScrollTargets = Array.from(new Set(scrollTargets.map((value) => Math.max(0, Math.round(value)))))

      function requestCapture(): Promise<string> {
        return new Promise((resolve, reject) => {
          cr.runtime.sendMessage({ type: 'screenshot:capture-frame' }, (resp) => {
            if (cr.runtime.lastError) {
              reject(new Error(cr.runtime.lastError.message ?? 'Capture failed'))
              return
            }
            if (resp.type === 'screenshot:frame-data' && resp.dataUrl) {
              resolve(resp.dataUrl)
            } else {
              reject(new Error(resp.error ?? 'Unexpected capture response'))
            }
          })
        })
      }

      const savedScrollX = window.scrollX
      const savedScrollY = window.scrollY
      const savedScrollBehavior = doc.style.scrollBehavior
      const frozen: Array<{
        el: HTMLElement
        visibility: string
        opacity: string
      }> = []

      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const pos = getComputedStyle(el).position
        if (pos === 'fixed' || pos === 'sticky') {
          frozen.push({
            el,
            visibility: el.style.visibility,
            opacity: el.style.opacity,
          })
          el.style.setProperty('visibility', 'hidden', 'important')
          el.style.setProperty('opacity', '0', 'important')
        }
      }

      try {
        doc.style.scrollBehavior = 'auto'

        let stitchCanvas: OffscreenCanvas | null = null
        let ctx: OffscreenCanvasRenderingContext2D | null = null
        let scaleX = 1
        let scaleY = 1
        let previousBottomCss = 0

        for (const targetY of uniqueScrollTargets) {
          window.scrollTo(0, targetY)
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          await new Promise<void>((resolve) => setTimeout(resolve, 120))

          const actualScrollY = Math.max(0, Math.round(window.scrollY))
          const sliceTopCss = Math.max(actualScrollY, previousBottomCss)
          const sliceBottomCss = Math.min(pageH, actualScrollY + viewportH)
          const sliceHeightCss = Math.max(0, sliceBottomCss - sliceTopCss)
          if (sliceHeightCss <= 0) {
            continue
          }

          const dataUrl = await requestCapture()
          const imgBlob = await fetch(dataUrl).then((response) => response.blob())
          const bitmap = await createImageBitmap(imgBlob)

          if (!stitchCanvas || !ctx) {
            scaleX = bitmap.width / Math.max(viewportW, 1)
            scaleY = bitmap.height / Math.max(viewportH, 1)
            stitchCanvas = new OffscreenCanvas(
              Math.max(1, Math.round(pageW * scaleX)),
              Math.max(1, Math.round(pageH * scaleY))
            )
            ctx = stitchCanvas.getContext('2d')
            if (!ctx) {
              bitmap.close()
              throw new Error('Unable to initialize screenshot canvas')
            }
          }

          const cropTopCss = Math.max(0, sliceTopCss - actualScrollY)
          const sourceY = Math.max(0, Math.round(cropTopCss * scaleY))
          const sourceH = Math.max(1, Math.round(sliceHeightCss * scaleY))
          const destY = Math.round(sliceTopCss * scaleY)

          ctx.drawImage(
            bitmap,
            0,
            sourceY,
            bitmap.width,
            sourceH,
            0,
            destY,
            bitmap.width,
            sourceH
          )
          bitmap.close()
          previousBottomCss = sliceBottomCss
        }

        if (!stitchCanvas) {
          throw new Error('Screenshot returned no frames')
        }

        const blob = await stitchCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read screenshot blob'))
          reader.readAsDataURL(blob)
        })

        return {
          dataUrl,
          metadata: {
            captureMode: 'full_page',
            pageWidth: pageW,
            pageHeight: pageH,
            viewportWidth: viewportW,
            viewportHeight: viewportH,
          },
        }
      } finally {
        doc.style.scrollBehavior = savedScrollBehavior
        for (const { el, visibility, opacity } of frozen) {
          el.style.visibility = visibility
          el.style.opacity = opacity
        }
        window.scrollTo(savedScrollX, savedScrollY)
      }
    },
  })

  const capture = result?.result
  if (!capture?.dataUrl) {
    throw new Error('Screenshot returned no data')
  }

  return capture
}
