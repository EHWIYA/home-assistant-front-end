import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

function generateFcmSwPlugin(): Plugin {
  const run = () => {
    spawnSync(process.execPath, ["scripts/generate-fcm-sw.mjs"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  };
  return {
    name: "generate-fcm-sw",
    configureServer() {
      run();
    },
    buildStart() {
      run();
    },
  };
}

export default defineConfig({
  plugins: [
    generateFcmSwPlugin(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      filename: "sw-v3.js",
      includeAssets: ["icons/*.png", "icons/*.svg", "firebase-messaging-sw.js"],
      manifest: {
        name: "hwiyaIoT",
        short_name: "hwiyaIoT",
        description: "휘야 집 IoT 대시보드",
        theme_color: "#0f1419",
        background_color: "#0f1419",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // HTML은 precache하지 않음 — 온라인에서 NetworkFirst로 최신 shell 수신
        importScripts: ["firebase-messaging-sw.js"],
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        globIgnores: ["**/*.html"],
        navigateFallback: null,
        navigationPreload: true,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigation",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
