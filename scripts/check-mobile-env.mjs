import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

const root = process.cwd()
const mode = 'production'
const env = loadEnv(mode, root, '')

const required = [
  ['VITE_SUPABASE_URL', 'Supabase project URL'],
  ['VITE_SUPABASE_ANON_KEY', 'Supabase anon/public key'],
]

const missing = required.filter(([key]) => !env[key]?.trim())

if (missing.length === 0) {
  process.exit(0)
}

const envFiles = [
  resolve(root, `.env.${mode}.local`),
  resolve(root, `.env.${mode}`),
  resolve(root, '.env.local'),
  resolve(root, '.env'),
].filter(existsSync)

console.error(
  [
    'Mobile build is missing required client environment variables:',
    ...missing.map(([key, label]) => `  - ${key} (${label})`),
    '',
    'Vercel env vars apply only to web deploys on Vercel. Native builds run locally',
    'and bake VITE_* values in at compile time via Vite.',
    '',
    envFiles.length
      ? `Loaded env files: ${envFiles.map((file) => file.replace(`${root}/`, '')).join(', ')}`
      : 'No .env files found.',
    '',
    'Fix:',
    '  1. cp .env.example .env.production',
    '  2. Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and set:',
    '     VITE_CLOUD_FIRST=true',
    '     VITE_API_BASE_URL=https://tradeshow-passport-raffle.vercel.app',
    '  3. npm run build:mobile',
    '',
    'Or run: npm run env:mobile (copies VITE_* from .env if present)',
  ].join('\n'),
)

process.exit(1)
