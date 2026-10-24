import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Voice Diary',
        short_name: 'Diary',
        display: 'standalone',
        start_url: '/',
        theme_color: '#2F5D45',
        background_color: '#FAF6EC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // auth + health endpoints → Express backend (dev: localhost:3000)
      '/api': 'http://localhost:3000',
    },
  },
})
