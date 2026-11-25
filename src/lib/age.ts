export const MIN_AGE = 18;
export const SERVICE_TIME_ZONE = "America/New_York";

/** Today's date (YYYY-MM-DD) in the service area's time zone. */
export function todayInServiceArea(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whole years between dob and today, both YYYY-MM-DD. Returns null for bad input. */
export function ageOn(dob: string, today: string): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!d || !t) return null;
  const [dy, dm, dd] = d.slice(1).map(Number);
  const check = new Date(Date.UTC(dy, dm - 1, dd));
  if (check.getUTCFullYear() !== dy || check.getUTCMonth() !== dm - 1 || check.getUTCDate() !== dd) return null;
  const [ty, tm, td] = t.slice(1).map(Number);
  let age = ty - dy;
  if (tm < dm || (tm === dm && td < dd)) age -= 1;
  return age;
}
