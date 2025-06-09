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
