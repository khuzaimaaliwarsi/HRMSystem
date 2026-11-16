import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const fallbackPath = path.join(distDir, '404.html')

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, fallbackPath)
  console.log('[SPA Routing] Successfully copied dist/index.html to dist/404.html for Vercel SPA fallback.')
} else {
  console.warn('[SPA Routing WARNING] dist/index.html not found, skipping 404.html generation.')
}
