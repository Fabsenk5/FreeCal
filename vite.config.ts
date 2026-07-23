import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],

      // Workbox runtime caching for offline support
      workbox: {
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Backend API responses (comments/checklists etc.) — NetworkFirst.
            // Auth- and user-sensitive routes (/api/auth/*, /api/push/*,
            // /api/users/*, /api/admin/*) are deliberately NOT matched here and
            // therefore never cached. GET only (workbox default), 5s network
            // timeout, 5 min TTL.
            urlPattern: /^https?:\/\/.*\/api\/(?!auth(?:\/|$)|push(?:\/|$)|users(?:\/|$)|admin(?:\/|$)).*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
            },
          },
          {
            // Supabase REST (frontend talks to Supabase directly) — NetworkFirst
            // so offline browsing keeps working with the last loaded data.
            // GET only, 5s network timeout, 5 min TTL.
            urlPattern: /^https?:\/\/[^/]*\.supabase\.co\/rest\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Self-hosted Inter variable font (@fontsource-variable/inter ships
            // hashed .woff2 assets) — immutable content, cache for a year.
            urlPattern: /^https?:\/\/.*\.woff2(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      manifest: {
        name: "Family Calendar - Find shared freedom",
        short_name: "Family Calendar",
        description: "Shared family calendar with OCR import - find time together",
        theme_color: "#3b82f6",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon/android/android-launchericon-192-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/favicon/android/android-launchericon-512-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module', // uses module syntax for service worker in dev
      }
    })
  ].filter(Boolean),
  // Split the big framework/data vendors out of the entry chunk: they change
  // far less often than app code, so separate chunks improve long-term caching.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));