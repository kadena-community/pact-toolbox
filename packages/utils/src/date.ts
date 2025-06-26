/**
 * Format a date using locale-aware formatting
 * @param date - Date object or ISO date string to format
 * @returns Formatted date string in the user's locale
 * @example
 * ```typescript
 * formatDate(new Date()); // "Dec 25, 2023, 10:30:00"
 * formatDate('2023-12-25T10:30:00Z'); // "Dec 25, 2023, 10:30:00"
 * ```
 */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    timeZone,
  });
}
