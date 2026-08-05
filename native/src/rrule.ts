import * as Calendar from 'expo-calendar';

const DAY_TO_WEEKDAY: Record<string, number> = {
  SU: 1, MO: 2, TU: 3, WE: 4, TH: 5, FR: 6, SA: 7,
};

/** Map an ICS FREQ token to the expo-calendar Frequency enum. */
function mapFrequency(freq: string | undefined): Calendar.Frequency {
  const key = (freq ?? '').toUpperCase() as keyof typeof Calendar.Frequency;
  const value = Calendar.Frequency[key];
  if (value !== undefined) return value;
  return Calendar.Frequency.WEEKLY;
}

function toDateParts(yyyymmdd: string): Date {
  const year = parseInt(yyyymmdd.slice(0, 4), 10);
  const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const day = parseInt(yyyymmdd.slice(6, 8), 10);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Parse an ICS RRULE string (as produced by src/utils/icsGenerator.ts on the
 * web side) into an expo-calendar RecurrenceRule object. Unsupported parts
 * (BYMONTHDAY on weekly rules etc.) are ignored, matching RFC 5545 semantics.
 */
export function parseRRULE(rrule: string | null | undefined): Calendar.RecurrenceRule | null {
  if (!rrule) return null;

  const parts: Record<string, string> = {};
  for (const piece of rrule.split(';')) {
    const eq = piece.indexOf('=');
    if (eq === -1) continue;
    parts[piece.slice(0, eq).toUpperCase()] = piece.slice(eq + 1);
  }

  const rule: Calendar.RecurrenceRule = { frequency: mapFrequency(parts.FREQ) };

  const interval = parseInt(parts.INTERVAL ?? '', 10);
  if (Number.isFinite(interval) && interval > 1) rule.interval = interval;

  if (parts.BYDAY) {
    const days = parts.BYDAY.split(',')
      .map((d) => {
        const m = d.trim().toUpperCase().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
        if (!m) return null;
        const weekNumber = m[1] ? parseInt(m[1], 10) : undefined;
        const day: { dayOfTheWeek: number; weekNumber?: number } = {
          dayOfTheWeek: DAY_TO_WEEKDAY[m[2]],
        };
        if (weekNumber) day.weekNumber = weekNumber;
        return day;
      })
      .filter((d): d is { dayOfTheWeek: number; weekNumber?: number } => d !== null);
    if (days.length > 0) rule.daysOfTheWeek = days;
  }

  if (parts.BYMONTHDAY) {
    const days = parts.BYMONTHDAY.split(',').map(Number).filter(Number.isFinite);
    if (days.length > 0) rule.daysOfTheMonth = days;
  }

  if (parts.BYMONTH) {
    const months = parts.BYMONTH.split(',').map(Number).filter(Number.isFinite);
    if (months.length > 0) rule.monthsOfTheYear = months;
  }

  if (parts.UNTIL) {
    const until = parts.UNTIL;
    const date = until.includes('T')
      ? new Date(
          `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}T${until.slice(9, 11)}:${until.slice(11, 13)}:${until.slice(13, 15)}Z`
        )
      : toDateParts(until);
    if (!isNaN(date.getTime())) rule.endDate = date;
  }

  const count = parseInt(parts.COUNT ?? '', 10);
  if (Number.isFinite(count) && count > 0) rule.occurrence = count;

  return rule;
}
