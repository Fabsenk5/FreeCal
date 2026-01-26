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
        runtimeCaching: [
          {
            // Cache auth endpoints with NetworkFirst strategy
            urlPattern: /^https?:\/\/.*\/api\/auth\/me$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'auth-cache',
              networkTimeoutSeconds: 30, // Wait 30s for network, then use cache
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache API responses with NetworkFirst
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 30,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
            },
          },
        ],
      },

      manifest: {
        name: "FreeCal - Calendar to find shared freedom",
        short_name: "FreeCal",
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));