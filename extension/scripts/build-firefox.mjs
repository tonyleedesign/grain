import { cp, copyFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const distDir = resolve(root, 'dist')
const firefoxDir = resolve(root, 'firefox')
const firefoxDistDir = resolve(firefoxDir, 'dist')
const firefoxManifest = resolve(root, 'manifest.firefox.json')
const firefoxBackgroundPage = resolve(root, 'background.firefox.html')

await rm(firefoxDir, { recursive: true, force: true })
await mkdir(firefoxDistDir, { recursive: true })
await cp(distDir, firefoxDistDir, { recursive: true })
await copyFile(firefoxManifest, resolve(firefoxDir, 'manifest.json'))
await copyFile(firefoxBackgroundPage, resolve(firefoxDir, 'background.html'))
