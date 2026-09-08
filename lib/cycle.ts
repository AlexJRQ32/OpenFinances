// Pure functions for billing-cycle date ranges. No I/O.

export type CycleMode = "quincenal" | "mensual";

export interface CycleRange {
  start: Date;
  end: Date;
  label: string;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTHS_ES_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * Build a UTC-midnight Date for the given year/month/day.
 * Using UTC avoids DST pitfalls when doing day arithmetic.
 */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Last day of the given month (1-indexed month). */
function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of next month = last day of current month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Compute the cycle range for the given mode and reference date.
 *
 * - "quincenal": days 1–15 or 16–end of month.
 * - "mensual": full calendar month.
 */
export function getCycleRange(mode: CycleMode, refDate: Date): CycleRange {
  const year = refDate.getUTCFullYear();
  const month = refDate.getUTCMonth(); // 0-indexed
  const day = refDate.getUTCDate();
  const lastDay = lastDayOfMonth(year, month + 1);

  if (mode === "mensual") {
    return {
      start: utcDate(year, month, 1),
      end: utcDate(year, month, lastDay),
      label: `${MONTHS_ES[month]} ${year}`,
    };
  }

  // quincenal
  if (day <= 15) {
    return {
      start: utcDate(year, month, 1),
      end: utcDate(year, month, 15),
      label: `1\u201315 ${MONTHS_ES_SHORT[month]}`,
    };
  }
  return {
    start: utcDate(year, month, 16),
    end: utcDate(year, month, lastDay),
    label: `16\u2013${lastDay} ${MONTHS_ES_SHORT[month]}`,
  };
}

/**
 * Check if a fixed item applies to the given cycle.
 *
 * - mensual → always true (month contains both quincenas)
 * - quincenal → dayOfMonth == null ? true : (day within cycle range)
 */
export function fixedAppliesToCycle(
  dayOfMonth: number | null | undefined,
  cycleStart: Date,
  cycleEnd: Date,
  mode: CycleMode
): boolean {
  if (mode === "mensual") return true;
  if (dayOfMonth == null) return true;
  const startDay = cycleStart.getUTCDate();
  const endDay = cycleEnd.getUTCDate();
  return dayOfMonth >= startDay && dayOfMonth <= endDay;
}

/**
 * Get the date range for a specific quincena in a given month.
 * @param year - Full year (e.g. 2026)
 * @param month - 0-indexed month (0 = January)
 * @param index - 1 for first quincena (1-15), 2 for second (16-end)
 */
export function getQuincenaRange(
  year: number,
  month: number,
  index: 1 | 2
): CycleRange {
  const day = index === 1 ? 1 : 16;
  return getCycleRange("quincenal", new Date(Date.UTC(year, month, day)));
}

/**
 * Shift a UTC date by the user's timezone offset so that getUTC* methods
 * return the user's local wall time.
 *
 * JS getTimezoneOffset convention: UTC-6 → +360 minutes.
 * Subtracting the offset yields a Date whose UTC fields match local time.
 *
 * Example: 2026-09-15T23:00Z with offset 360 (UTC-6) → shifted reads Sep 15 17:00 UTC.
 */
export function shiftToOffset(date: Date, tzOffsetMinutes: number): Date {
  return new Date(date.getTime() - tzOffsetMinutes * 60_000);
}

/**
 * Compute the next cycle boundary in the user's LOCAL timezone.
 *
 * - "quincenal": next occurrence of day 16 at 00:00 local, or day 1 of the
 *   following month at 00:00 local if already past the 16th.
 * - "mensual": day 1 of the following month at 00:00 local.
 *
 * The returned Date is always strictly >= `now` (equal when `now` sits exactly
 * on a boundary at 00:00:00.000 local).
 */
export function getNextCycleBoundary(mode: CycleMode, now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  if (mode === "mensual") {
    return new Date(year, month + 1, 1);
  }

  // quincenal
  if (day < 16) {
    return new Date(year, month, 16);
  }
  return new Date(year, month + 1, 1);
}
