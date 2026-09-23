// Zentrale Definition der drei Hauptbereiche (Req 14.1): Timer, Statistik,
// Einstellungen. Wird von Navigation (NavLinks) und AppShell (Routes) gemeinsam
// genutzt, damit Pfade und Labels an einer Stelle gepflegt werden.

export interface NavRoute {
  /** Routen-Pfad (HashRouter). */
  path: string;
  /** Sichtbares Label / Screenreader-Label (Req 18.2). */
  label: string;
  /** Dezentes Symbol (zusätzlich zum Text, nicht nur Farbe – Req 18.3). */
  icon: string;
}

/** Die genau drei Hauptbereiche der App (Req 14.1). */
export const NAV_ROUTES: readonly NavRoute[] = [
  { path: '/', label: 'Timer', icon: '⏱' },
  { path: '/stats', label: 'Statistik', icon: '📊' },
  { path: '/settings', label: 'Einstellungen', icon: '⚙️' },
] as const;
