/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Konfiguration der Pomodoro-PWA (Req 17).
// - vite-plugin-pwa (Workbox generateSW): Manifest, Service Worker, Precaching.
// - registerType 'autoUpdate': neue Versionen werden automatisch übernommen.
// - injectRegister 'auto': SW-Registrierung wird automatisch injiziert; die App
//   registriert den SW zusätzlich über virtual:pwa-register in main.tsx.
// - Da die App keine Serverdaten benötigt (Timer via localStorage, Statistik via
//   IndexedDB), genügt das Precaching aller Build-Assets für die Offline-Nutzung
//   (Req 17.2, 17.3).
//
// Deployment-Basis-Pfad:
// - Standardmäßig wird die App in einem Unterordner ausgeliefert (z. B. Uberspace
//   unter https://<user>.uber.space/pomodoro/). Der Basis-Pfad ist über die
//   Umgebungsvariable BASE_PATH überschreibbar; für Root-Deployments `BASE_PATH=/`
//   setzen. Alle PWA-Pfade (start_url, scope, navigateFallback) werden daraus
//   abgeleitet, damit Assets, Manifest und Service Worker im Unterordner korrekt
//   auflösen.
const BASE_PATH = process.env.BASE_PATH ?? '/pomodoro/';
// Sicherstellen, dass der Basis-Pfad mit Slash beginnt und endet.
const normalizedBase = `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const base = normalizedBase === '//' ? '/' : normalizedBase;

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Icons liegen unter public/icons und werden mit ausgeliefert.
      includeAssets: ['icons/pwa-192x192.png', 'icons/pwa-512x512.png', 'icons/maskable-512x512.png'],
      manifest: {
        name: 'Pomodoro',
        short_name: 'Pomodoro',
        description:
          'Minimalistischer Pomodoro-Timer als installierbare PWA. Alle Daten bleiben lokal auf deinem Gerät.',
        lang: 'de',
        display: 'standalone',
        // start_url/scope am Basis-Pfad ausrichten (Unterordner-fähig).
        start_url: base,
        scope: base,
        // Farben abgeleitet aus tokens.css (Light Mode) und index.html theme-color.
        theme_color: '#faf9f7',
        background_color: '#faf9f7',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Alle relevanten Build-Assets vorab cachen -> App startet und läuft
        // vollständig offline (Req 17.2, 17.3).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // SPA: Navigationsanfragen offline auf die index.html im Basis-Pfad zurückführen.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Im Dev-Server standardmäßig aus, damit HMR/Tests nicht beeinträchtigt werden.
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
