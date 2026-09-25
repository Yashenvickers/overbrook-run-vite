import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['rapdm-mark.svg'],
      manifest: {
        name: 'RAP CITY: NIGHT RUN',
        short_name: 'RAP CITY',
        description: 'A browser FPS prototype by Rap Digital Marketing.',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: './',
        scope: './',
        icons: [
          {
            src: './rapdm-mark.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        cleanupOutdatedCaches: true
      }
    })
  ]
});
