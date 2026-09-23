import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element #root wurde nicht gefunden.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service Worker der PWA registrieren (Req 17.1). Precaching macht die App nach
// dem ersten Laden offline nutzbar (Req 17.2/17.3); die Registration stellt
// zudem showNotification für Hintergrund-Benachrichtigungen bereit (Req 8.6).
// registerType 'autoUpdate' übernimmt neue Versionen selbstständig.
// Guarded: nur im Browser mit ServiceWorker-Unterstützung und außerhalb von
// Tests (import.meta.env.MODE !== 'test'), damit jsdom/Vitest nicht am
// virtuellen Modul scheitern.
if (import.meta.env.MODE !== 'test' && 'serviceWorker' in navigator) {
  // Dynamischer Import: Das virtuelle Modul existiert nur zur Build-/Dev-Zeit
  // mit aktivem vite-plugin-pwa. Fehler werden still ignoriert (Req 20.1).
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      // Kein SW verfügbar -> App funktioniert weiterhin (nur ohne Offline-Cache).
    });
}
