// Datums-Formatierung für die Statistik-Ansicht (Task 12, Req 11.4).
//
// Wandelt den kanonischen Tagesschlüssel `YYYY-MM-DD` (siehe stats/aggregate.ts) in
// eine menschenlesbare deutsche Datumsangabe um. Rein und ohne Seiteneffekte, damit sie
// deterministisch testbar ist. Kein Rückgriff auf `Intl` mit Zeitzonen-Fallstricken:
// Der Schlüssel repräsentiert bereits ein lokales Datum, daher formatieren wir aus den
// Bestandteilen direkt.

const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
const MONTHS_LONG = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** True, wenn `dateKey` exakt dem Format `YYYY-MM-DD` mit plausiblen Werten entspricht. */
function parseKey(
  dateKey: string,
): { year: number; month: number; day: number; date: Date } | null {
  if (typeof dateKey !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Lokales Datum (Mitternacht) – konsistent zu dateFromKey in aggregate.ts.
  const date = new Date(year, month - 1, day);
  // Rundreise-Prüfung fängt ungültige Tage wie 2024-02-31 ab.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day, date };
}

/**
 * Formatiert einen Tagesschlüssel `YYYY-MM-DD` als deutsches Datum, z. B.
 * „Mo, 3. Juni 2024".
 *
 * Ungültige oder leere Schlüssel werden unverändert zurückgegeben (defensiver Fallback),
 * damit die UI nie leer bleibt.
 */
export function formatGermanDate(dateKey: string): string {
  const parsed = parseKey(dateKey);
  if (!parsed) return dateKey ?? '';
  const { day, month, date } = parsed;
  const weekday = WEEKDAYS_SHORT[date.getDay()];
  const monthName = MONTHS_LONG[month - 1];
  return `${weekday}, ${day}. ${monthName} ${parsed.year}`;
}

/**
 * Formatiert einen Tagesschlüssel kompakt als „TT.MM." (Tag und Monat, deutsche Notation).
 * Für kompakte Achsenbeschriftungen/Listen gedacht. Fallback wie {@link formatGermanDate}.
 */
export function formatGermanDateShort(dateKey: string): string {
  const parsed = parseKey(dateKey);
  if (!parsed) return dateKey ?? '';
  const { day, month } = parsed;
  return `${day}.${month}.`;
}
