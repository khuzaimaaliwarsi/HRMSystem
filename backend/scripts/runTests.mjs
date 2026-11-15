import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const backendDir = path.resolve(import.meta.dirname, '..')
const env = { ...process.env, NODE_ENV: 'test' }

// Dynamically discover *.test.js files cleanly on Windows/POSIX
const testDir = path.join(backendDir, 'tests')
const files = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .map((f) => path.join('tests', f))

const res = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=1', ...files],
  {
    cwd: backendDir,
    env,
    stdio: 'inherit'
  }
)

process.exit(res.status ?? 1)

