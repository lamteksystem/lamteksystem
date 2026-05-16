import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/** GitHub Pages project sites use `/<repo>/`; local dev uses `/`. Set `VITE_PAGES_BASE` in CI. */
function viteBase(): string {
  const raw = process.env.VITE_PAGES_BASE?.trim()
  if (!raw || raw === '/') return '/'
  return raw.endsWith('/') ? raw : `${raw}/`
}

export default defineConfig({
  base: viteBase(),
  plugins: [react()],
  server: {
    // Listen on all interfaces so localhost / 127.0.0.1 / LAN work reliably (Windows IPv4/IPv6 quirks).
    host: true,
    port: Number(process.env.VITE_DEV_PORT || process.env.PORT || 5173),
    strictPort: true,
    allowedHosts: true,
    hmr: {
      overlay: true,
    },
  },
  preview: {
    host: true,
    port: Number(process.env.VITE_DEV_PORT || process.env.PORT || 5173),
    strictPort: true,
    allowedHosts: true,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
