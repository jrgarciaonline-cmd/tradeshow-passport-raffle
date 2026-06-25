import { spawn } from 'node:child_process'
import { loadEnvFile } from './load-env.mjs'

loadEnvFile()

const apiPort = process.env.LOCAL_API_PORT || '3001'
const proxyTarget = `http://127.0.0.1:${apiPort}`
const sharedEnv = {
  ...process.env,
  ADMIN_API_PROXY_TARGET: proxyTarget,
}

function run(command, args, label) {
  const child = spawn(command, args, {
    env: sharedEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${label} stopped (${signal})`)
      return
    }

    if (code && code !== 0) {
      console.log(`${label} exited with code ${code}`)
    }
  })

  return child
}

console.log(`Starting local admin API on ${proxyTarget}`)

const apiProcess = run('node', ['scripts/local-api-server.mjs'], 'Local API')
const previewProcess = run('npm', ['run', 'preview'], 'Vite preview')

function shutdown() {
  apiProcess.kill('SIGTERM')
  previewProcess.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
