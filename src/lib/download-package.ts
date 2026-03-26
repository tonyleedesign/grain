// Download utility — triggers browser downloads for the multi-file export package.
// Markdown files are generated from strings, image files are fetched from canvas URLs.

import type { WebAppDNA } from '@/types/dna'
import { formatReadme, formatStyle, formatComposition, formatAssets, getImageExtension } from './export-formatters'

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadImage(filename: string, imageUrl: string) {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Download the full export package: 3-4 markdown files + image files.
 * Downloads are staggered by 100ms to avoid browser popup blockers.
 */
export async function downloadPackage(opts: {
  dna: WebAppDNA
  useCase?: string
  imageUrls: string[]
  checkedIndices: number[]
}) {
  const { dna, useCase, imageUrls, checkedIndices } = opts

  // Markdown files
  downloadMarkdown('README.md', formatReadme(dna, useCase))
  await delay(100)

  downloadMarkdown('style.md', formatStyle(dna))
  await delay(100)

  downloadMarkdown('composition.md', formatComposition(dna))
  await delay(100)

  // Assets (only if images are checked)
  if (checkedIndices.length > 0) {
    const assetsContent = formatAssets(dna, imageUrls, checkedIndices)
    if (assetsContent) {
      downloadMarkdown('assets.md', assetsContent)
      await delay(100)
    }

    // Download actual image files
    for (const idx of checkedIndices) {
      if (idx < 0 || idx >= imageUrls.length) continue
      const assetNum = checkedIndices.indexOf(idx) + 1
      const ext = getImageExtension(imageUrls[idx])
      await downloadImage(`asset-${assetNum}.${ext}`, imageUrls[idx])
      await delay(100)
    }
  }
}
