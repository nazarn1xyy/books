import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite'
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sitemap.xml', 'robots.txt'],
      manifest: {
        name: 'Libify - Читалка книг',
        short_name: 'Libify',
        description: 'Читалка книг з доступом до Flibusta',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/charts-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Catalog covers proxied by our API: immutable enough to serve from cache.
            urlPattern: ({ url }) => url.pathname === '/api/catalog/image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'catalog-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Cache Flibusta images (proxied)
            urlPattern: /^https?:\/\/.*\/.*(jpg|jpeg|png|gif|webp)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      }
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    sourcemap: false, // Disable sourcemaps in production for smaller bundle
  },
  server: {
    proxy: {
      // Same origin in dev, so the session cookie and the Origin check work like in production.
      // LIBIFY_API_URL lets e2e run against its own API instance.
      '/api': { target: process.env.LIBIFY_API_URL ?? 'http://localhost:3000' },
    },
  },
})
