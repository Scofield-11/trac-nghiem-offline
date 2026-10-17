import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-180.jpg', 'logo-512.jpg', 'favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Thi Trắc Nghiệm Offline',
        short_name: 'Trắc Nghiệm',
        description: 'Ứng dụng ôn luyện trắc nghiệm chạy Offline trên điện thoại',
        theme_color: '#7c3aed',
        background_color: '#eef0ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo-180.jpg',
            sizes: '180x180',
            type: 'image/jpeg'
          },
          {
            src: '/logo-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
})