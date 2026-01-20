import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { SocksProxyAgent } from 'socks-proxy-agent';

// Tor proxy agent (default port 9050)
// Tor proxy agent (default port 9050)
const torAgent = new SocksProxyAgent('socks5h://127.0.0.1:9050', {
  keepAlive: true,
  timeout: 60000
});

import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Flibusta Reader',
        short_name: 'Libify',
        description: 'Flibusta Book Reader via Tor',
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
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
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
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/static_flibusta': {
        target: 'http://static.flibusta.is',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/static_flibusta/, ''),
        agent: torAgent,
      },
      '/flibusta': {
        // Use the onion address directly for maximum reliability via Tor
        target: 'http://flibustaongezhld6dibs2dps6vm4nvqg2kp7vgowbu76tzopgnhazqd.onion',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/flibusta/, ''),
        agent: torAgent,
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            let location = proxyRes.headers['location'] || proxyRes.headers['Location'];
            if (location) {
              if (Array.isArray(location)) location = location[0];

              console.log('Detected redirect to:', location);

              const staticMatch = location.match(/^https?:\/\/static\.flibusta\.is(:\d+)?/);
              // Match both cleartext domain and onion domain
              const mainMatch = location.match(/^https?:\/\/flibusta\.is(:\d+)?/) || location.match(/^http:\/\/flibustaongezhld6dibs2dps6vm4nvqg2kp7vgowbu76tzopgnhazqd\.onion(:\d+)?/);

              if (staticMatch) {
                const newLoc = location.replace(staticMatch[0], '/static_flibusta');
                console.log('Rewriting redirect to static proxy:', newLoc);
                proxyRes.headers['location'] = newLoc;
              } else if (mainMatch) {
                const newLoc = location.replace(mainMatch[0], '/flibusta');
                console.log('Rewriting redirect to main proxy:', newLoc);
                proxyRes.headers['location'] = newLoc;
              }
            }
          });
        },
      },
    },
  },
})
