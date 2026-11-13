// Attendance dates are India dates (qr-scan writes them in Asia/Kolkata).
// toISOString() gives the UTC date, which is still "yesterday" between
// midnight and 5:30 AM IST, so "today" lookups came back empty then.

/** YYYY-MM-DD in India for the given instant (default: now). */
export function istDate(at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The India date `days` days before today. */
export function istDaysAgo(days: number): string {
  return istDate(new Date(Date.now() - days * 86_400_000));
}
