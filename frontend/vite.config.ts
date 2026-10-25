import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: /api is proxied to the FastAPI server. Prod (Vercel/Docker): same-origin /api.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': process.env.API_URL ?? 'http://127.0.0.1:8000' },
  },
})
