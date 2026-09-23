// Hauptnavigation der App (Task 8, Req 14.1–14.4, 18).
//
// Stellt genau drei Ziele bereit: Timer, Statistik, Einstellungen (Req 14.1). Die Links
// nutzen react-router `NavLink`, sodass der aktive Bereich hervorgehoben wird. Layout und
// Responsive-Verhalten (Top auf Desktop, Bottom auf Mobile) sowie große Touch-Ziele
// stecken in `Navigation.css`.
//
// Accessibility (Req 18): Die Navigation ist als <nav> mit aria-label ausgezeichnet, die
// Icons sind rein dekorativ (aria-hidden), die Linktexte tragen die zugänglichen Namen.

import { NavLink } from 'react-router-dom';
import './Navigation.css';

/** Ein Navigationsziel: Route, sichtbares Label und dekoratives Icon. */
interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** `end` für die Index-Route, damit "/" nicht bei allen Pfaden aktiv ist. */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Timer', icon: '⏱', end: true },
  { to: '/stats', label: 'Statistik', icon: '📊' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙' },
];

/** Kombiniert die Basisklasse mit der aktiv-Klasse für NavLink. */
function linkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-nav__link is-active' : 'app-nav__link';
}

export default function Navigation() {
  return (
    <nav className="app-nav" aria-label="Hauptnavigation">
      <ul className="app-nav__list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={linkClassName}>
              <span className="app-nav__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
