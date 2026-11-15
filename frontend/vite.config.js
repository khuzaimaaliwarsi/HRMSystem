import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        proxyTimeout: 30000,
        configure(proxy) {
          proxy.on('error', (err, _req, res) => {
            if (!res || res.headersSent || res.writableEnded) return
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                success: false,
                error: {
                  code: 'BAD_GATEWAY',
                  message:
                    'Backend API server (port 5000) is temporarily unreachable or restarting. Please wait a moment and try again.',
                  details: err?.code || err?.message || null
                }
              })
            )
          })
        }
      },
    },
  },
})
