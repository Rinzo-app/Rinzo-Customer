// Shop hours come from the backend as 24-hour "HH:MM" strings.
// Convert to a friendly 12-hour AM/PM label for display.

/** "20:00" (24h) → "8:00 PM". Returns the input unchanged if unparseable. */
export function formatTime12h(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const minute = m[2];
  if (h < 0 || h > 23) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${minute} ${period}`;
}

/** "08:00"–"20:00" → "8:00 AM – 8:00 PM". Empty string if both missing. */
export function formatHoursRange(
  open: string | null | undefined,
  close: string | null | undefined,
): string {
  const o = formatTime12h(open);
  const c = formatTime12h(close);
  if (!o && !c) return "";
  return `${o} – ${c}`;
}
