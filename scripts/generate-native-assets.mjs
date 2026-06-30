#!/usr/bin/env node
/**
 * Generate iOS, Android, and PWA icons from public/appstore.png.
 *
 * Native apps read from ios/App/... and android/app/..., not from public/.
 * Run this whenever appstore.png changes, before build:mobile / TestFlight.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceIcon = join(root, 'public', 'appstore.png')
const resourcesDir = join(root, 'resources')
const resourcesIcon = join(resourcesDir, 'icon.png')
const pwaAssetRoot = join(root, 'public', 'assets')
const manifestPath = join(root, 'public', 'manifest.webmanifest')

function fail(message) {
  console.error(`assets:generate — ${message}`)
  process.exit(1)
}

if (!existsSync(sourceIcon)) {
  fail('missing public/appstore.png (1024×1024 source icon)')
}

mkdirSync(resourcesDir, { recursive: true })
copyFileSync(sourceIcon, resourcesIcon)

// @capacitor/assets writes PWA icons under public/assets/icons when this folder exists.
mkdirSync(pwaAssetRoot, { recursive: true })

const generate = spawnSync(
  'npx',
  [
    '@capacitor/assets',
    'generate',
    '--iconBackgroundColor',
    '#007b70',
    '--splashBackgroundColor',
    '#007b70',
  ],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
)

if (generate.status !== 0) {
  process.exit(generate.status ?? 1)
}

fixManifest(manifestPath)
removeLegacyRootIcons(join(root, 'icons'))
console.log('assets:generate — native icons updated from public/appstore.png')

function fixManifest(path) {
  if (!existsSync(path)) return

  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(manifest.icons)) return

  manifest.icons = manifest.icons.map((icon) => {
    const normalizedSrc = icon.src
      .replace(/^\.\.\//, '/')
      .replace(/^assets\//, '/assets/')
      .replace(/^icons\//, '/assets/icons/')
      .replace(/^\/assets\/assets\//, '/assets/')

    const src = normalizedSrc.startsWith('/') ? normalizedSrc : `/${normalizedSrc}`

    return {
      ...icon,
      src,
      type: 'image/webp',
    }
  })

  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

function removeLegacyRootIcons(path) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true })
  }
}
