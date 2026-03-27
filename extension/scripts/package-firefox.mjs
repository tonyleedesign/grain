import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { resolve, relative, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const firefoxDir = resolve(root, 'firefox')
const releaseDir = resolve(root, 'release')
const outputFile = resolve(releaseDir, 'send-to-grain-firefox.xpi')

async function addDirectoryToZip(zip, dir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)
    const zipPath = posix.join(...relative(baseDir, fullPath).split('\\'))

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, baseDir)
      continue
    }

    const file = await readFile(fullPath)
    zip.file(zipPath, file)
  }
}

const manifestPath = resolve(firefoxDir, 'manifest.json')
const manifestStats = await stat(manifestPath).catch(() => null)

if (!manifestStats) {
  throw new Error('Firefox build not found. Run `npm --prefix extension run build:firefox` first.')
}

const zip = new JSZip()
await addDirectoryToZip(zip, firefoxDir, firefoxDir)

await mkdir(releaseDir, { recursive: true })
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})

await writeFile(outputFile, buffer)
console.log(`Created ${outputFile}`)
