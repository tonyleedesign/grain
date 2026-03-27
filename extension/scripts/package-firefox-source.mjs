import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const releaseDir = resolve(root, 'release')
const outputFile = resolve(releaseDir, 'send-to-grain-firefox-source.zip')

const includedFiles = [
  'README.mozilla.md',
  'package.json',
  'tsconfig.json',
  'manifest.firefox.json',
  'manifest.json',
  'popup.html',
  'background.firefox.html',
]

const includedDirectories = [
  'src',
  'scripts',
]

async function addPath(zip, fullPath, zipRoot) {
  const stat = await import('node:fs/promises').then((fs) => fs.stat(fullPath))

  if (stat.isDirectory()) {
    const entries = await readdir(fullPath, { withFileTypes: true })
    for (const entry of entries) {
      await addPath(zip, resolve(fullPath, entry.name), zipRoot)
    }
    return
  }

  const content = await readFile(fullPath)
  const zipPath = posix.join(...relative(zipRoot, fullPath).split('\\'))
  zip.file(zipPath, content)
}

const zip = new JSZip()

for (const file of includedFiles) {
  await addPath(zip, resolve(root, file), root)
}

for (const dir of includedDirectories) {
  await addPath(zip, resolve(root, dir), root)
}

await mkdir(releaseDir, { recursive: true })
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})

await writeFile(outputFile, buffer)
console.log(`Created ${outputFile}`)
