import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.app', '.loca.lt', 'localhost', '127.0.0.1'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
