// Download utility — bundles export package into a single zip file.

import JSZip from 'jszip'
import type { WebAppDNA } from '@/types/dna'
import { formatReadme, formatStyle, formatComposition, formatAssets, getImageExtension } from './export-formatters'

/**
 * Download the full export package as a single zip file.
 * Contains markdown files + selected image files.
 */
export async function downloadPackage(opts: {
  dna: WebAppDNA
  useCase?: string
  imageUrls: string[]
  checkedIndices: number[]
}) {
  const { dna, useCase, imageUrls, checkedIndices } = opts
  const zip = new JSZip()

  // Markdown files
  zip.file('README.md', formatReadme(dna, useCase))
  zip.file('style.md', formatStyle(dna))
  zip.file('composition.md', formatComposition(dna))

  // Assets (only if images are checked)
  if (checkedIndices.length > 0) {
    const assetsContent = formatAssets(dna, imageUrls, checkedIndices)
    if (assetsContent) {
      zip.file('assets.md', assetsContent)
    }

    // Fetch and add image files
    for (let pos = 0; pos < checkedIndices.length; pos++) {
      const idx = checkedIndices[pos]
      if (idx < 0 || idx >= imageUrls.length) continue
      try {
        const response = await fetch(imageUrls[idx])
        if (!response.ok) continue
        const blob = await response.blob()
        const ext = getImageExtension(imageUrls[idx])
        zip.file(`asset-${pos + 1}.${ext}`, blob)
      } catch {
        console.warn(`Failed to fetch image ${idx}`)
      }
    }
  }

  // Generate and download zip
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'grain-export.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
