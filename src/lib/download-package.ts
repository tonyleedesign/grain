// Download utility — bundles export package into a single zip file.

import JSZip from 'jszip'
import type { WebAppDNA, DesignMD } from '@/types/dna'
import {
  formatReadme,
  formatStyle,
  formatComposition,
  formatAssets,
  formatDesignMd,
  formatDesignPackageReadme,
  formatDesignAssets,
  formatDesignTokensJson,
  getImageExtension,
  type ExportImage,
} from './export-formatters'

async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    if (url.startsWith('data:')) {
      const [header, base64] = url.split(',')
      const mimeMatch = header.match(/data:([^;]+)/)
      const mime = mimeMatch?.[1] ?? 'image/png'
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    }

    const response = await fetch(url)
    if (response.ok) return await response.blob()
  } catch {
    // Fall back to the server proxy below. Browser fetch can fail for images
    // that display in <img> but disallow CORS reads needed for zipping.
  }

  try {
    if (!/^https?:\/\//i.test(url)) return null
    const proxied = await fetch(`/api/export-image?url=${encodeURIComponent(url)}`)
    if (!proxied.ok) return null
    return await proxied.blob()
  } catch {
    return null
  }
}

/**
 * Download the full export package as a single zip file.
 * Contains markdown files + selected image files.
 */
export async function downloadPackage(opts: {
  dna: WebAppDNA | DesignMD
  dnaVersion?: string | null
  useCase?: string
  imageUrls: string[]
  checkedIndices: number[]
}) {
  const { dna, dnaVersion, useCase, imageUrls, checkedIndices } = opts
  const zip = new JSZip()

  if (dnaVersion === 'design-md-v1') {
    const designMd = dna as DesignMD
    const validIndices = checkedIndices.filter(idx => idx >= 0 && idx < imageUrls.length)
    const images: ExportImage[] = validIndices.map((idx, pos) => ({
      url: imageUrls[idx],
      index: pos,
      sourceIndex: idx,
    }))

    zip.file('README.md', formatDesignPackageReadme(designMd, useCase, images.length > 0 ? images : undefined))
    zip.file('DESIGN.md', formatDesignMd(designMd, images.length > 0 ? images : undefined))
    zip.file('ASSETS.md', formatDesignAssets(designMd, images))
    zip.file('design_tokens.json', formatDesignTokensJson(designMd))

    for (let pos = 0; pos < validIndices.length; pos++) {
      const idx = validIndices[pos]
      const blob = await fetchImageBlob(imageUrls[idx])
      if (!blob) { console.warn(`Failed to fetch image ${idx}`); continue }
      const ext = getImageExtension(imageUrls[idx])
      zip.file(`asset-${pos + 1}.${ext}`, blob)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grain-export.zip'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }

  const webDna = dna as WebAppDNA

  // Markdown files
  zip.file('README.md', formatReadme(webDna, useCase))
  zip.file('style.md', formatStyle(webDna))
  zip.file('composition.md', formatComposition(webDna))

  // Assets (only if images are checked)
  if (checkedIndices.length > 0) {
    const assetsContent = formatAssets(webDna, imageUrls, checkedIndices)
    if (assetsContent) {
      zip.file('assets.md', assetsContent)
    }

    // Fetch and add image files
    for (let pos = 0; pos < checkedIndices.length; pos++) {
      const idx = checkedIndices[pos]
      if (idx < 0 || idx >= imageUrls.length) continue
      const blob = await fetchImageBlob(imageUrls[idx])
      if (!blob) { console.warn(`Failed to fetch image ${idx}`); continue }
      const ext = getImageExtension(imageUrls[idx])
      zip.file(`asset-${pos + 1}.${ext}`, blob)
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
