/**
 * Maps events from the native iOS calendar bridge (expo-calendar) into the
 * ParsedEvent shape used by the ICS import flow, so CreateEvent can pre-fill
 * the form with identical logic.
 */
import type { ParsedEvent } from '@/utils/icsParser';
import type { NativeCalendarEvent, NativeRecurrenceRule } from '@/lib/nativeBridge';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQ_VALUES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

/**
 * Convert the expo-calendar RecurrenceRule object into an ICS RRULE string.
 * dayOfTheWeek follows iOS EKWeekday (1 = Sunday ... 7 = Saturday); 0-based
 * values are tolerated defensively.
 */
export function nativeRecurrenceToRRULE(
  rule: NativeRecurrenceRule | null | undefined
): string | undefined {
  if (!rule) return undefined;

  const freq = String(rule.frequency || '').toUpperCase();
  if (!FREQ_VALUES.includes(freq)) return undefined;

  const parts = [`FREQ=${freq}`];

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.daysOfTheWeek && rule.daysOfTheWeek.length > 0) {
    const byday = rule.daysOfTheWeek
      .map((d) => {
        const raw = d.dayOfTheWeek;
        const index = raw >= 1 && raw <= 7 ? (raw - 1) % 7 : Math.abs(raw) % 7;
        const code = DAY_CODES[index];
        if (!code) return null;
        return d.weekNumber ? `${d.weekNumber}${code}` : code;
      })
      .filter((code): code is string => !!code);
    if (byday.length > 0) {
      parts.push(`BYDAY=${byday.join(',')}`);
    }
  }

  if (rule.daysOfTheMonth && rule.daysOfTheMonth.length > 0) {
    parts.push(`BYMONTHDAY=${rule.daysOfTheMonth.join(',')}`);
  }
  if (rule.monthsOfTheYear && rule.monthsOfTheYear.length > 0) {
    parts.push(`BYMONTH=${rule.monthsOfTheYear.join(',')}`);
  }

  if (rule.endDate) {
    parts.push(`UNTIL=${toICSDateTime(rule.endDate)}`);
  }
  if (rule.occurrence && rule.occurrence > 0) {
    parts.push(`COUNT=${rule.occurrence}`);
  }

  return parts.join(';');
}

/** ISO timestamp or date string -> 'YYYYMMDDTHHMMSSZ' (UTC). */
function toICSDateTime(dateLike: string): string {
  const d = new Date(dateLike);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours()
  )}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

/** 'YYYY-MM-DD' from the UTC date part (all-day events are UTC midnights). */
function utcDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function localDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localTimeHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Map a native iOS calendar event to ParsedEvent. All-day end dates are
 * normalized (EventKit endDate is exclusive, like ICS DTEND); timed events
 * are converted from UTC to the local wall clock, same as parseICS.
 */
export function nativeEventToParsedEvent(ev: NativeCalendarEvent): ParsedEvent {
  const isAllDay = !!ev.allDay;
  let startDate = '';
  let endDate = '';
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (isAllDay) {
    startDate = ev.startDate ? utcDateOnly(ev.startDate) : '';
    if (ev.endDate) {
      endDate = utcDateOnly(ev.endDate);
      if (endDate > startDate) {
        // EventKit all-day endDate is exclusive — the day AFTER the last day.
        endDate = addDays(endDate, -1);
      }
    }
  } else {
    const start = new Date(ev.startDate);
    if (!Number.isNaN(start.getTime())) {
      startDate = localDateOnly(start);
      startTime = localTimeHM(start);
    }
    const end = new Date(ev.endDate || ev.startDate);
    if (!Number.isNaN(end.getTime())) {
      endDate = localDateOnly(end);
      endTime = localTimeHM(end);
    }
  }

  return {
    title: ev.title || '(Untitled event)',
    description: ev.notes || undefined,
    location: ev.location || undefined,
    url: ev.url || undefined,
    startDate,
    endDate: endDate || startDate,
    startTime: isAllDay ? undefined : startTime,
    endTime: isAllDay ? undefined : endTime,
    isAllDay,
    recurrenceRule: nativeRecurrenceToRRULE(ev.recurrenceRule),
    alerts: (ev.alarms ?? [])
      .filter((a) => typeof a.relativeOffset === 'number' && a.relativeOffset < 0)
      .map((a) => ({ minutes: Math.abs(a.relativeOffset), type: 'DISPLAY' })),
    isTentative: /tentative/i.test(String(ev.status ?? '')),
  };
}
