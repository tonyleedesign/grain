import { mkdir, copyFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const distDir = resolve(root, 'dist')
const sourcePopup = resolve(root, 'popup.html')
const targetPopup = resolve(distDir, 'popup.html')
const sourceLogo = resolve(root, '..', 'public', 'brand', 'grain-logo.svg')
const iconsDir = resolve(distDir, 'icons')
const iconSizes = [16, 32, 48, 128]

await mkdir(dirname(targetPopup), { recursive: true })
await copyFile(sourcePopup, targetPopup)
await mkdir(iconsDir, { recursive: true })

for (const size of iconSizes) {
  const badgeSize = Math.round(size * 0.94)
  const logoSize = Math.round(size * 0.7)
  const circleSvg = Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${badgeSize / 2}" fill="#FFF7ED" stroke="#D8C8B6" stroke-width="${Math.max(1, size * 0.035)}" />
    </svg>`
  )

  const logoBuffer = await sharp(sourceLogo)
    .resize({
      width: logoSize,
      height: logoSize,
      fit: 'contain',
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: circleSvg },
      {
        input: logoBuffer,
        left: Math.round((size - logoSize) / 2),
        top: Math.round((size - logoSize) / 2),
      },
    ])
    .png()
    .toFile(resolve(iconsDir, `grain-${size}.png`))
}
