/**
 * ICS (iCalendar) generator for exporting FreeCal events.
 * Produces RFC 5545 compliant output: CRLF line endings, text escaping,
 * 75-octet line folding, UTC date-times, VALUE=DATE all-day events with an
 * exclusive DTEND, and RRULEs built from the structured recurrence fields.
 */
import type { Event } from '@/lib/api';

const CRLF = '\r\n';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Escape a TEXT property value per RFC 5545 (§3.3.11). */
export function escapeICSValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\\n');
}

/** 'YYYYMMDD' from the UTC date part of an ISO timestamp or date string. */
function toICSDays(dateLike: string): string {
  const d = new Date(dateLike);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** 'YYYYMMDDTHHMMSSZ' (UTC) from an ISO timestamp. */
function toICSDateTime(dateLike: string): string {
  const d = new Date(dateLike);
  return `${toICSDays(dateLike)}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

/** Fold lines longer than 75 octets with a CRLF + single-space continuation. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let chunk = '';
  let chunkBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // Continuation lines carry a leading space, so they may hold 74 bytes.
    const limit = result === '' ? 75 : 74;
    if (chunkBytes + charBytes > limit) {
      result += chunk + CRLF + ' ';
      chunk = char;
      chunkBytes = charBytes;
    } else {
      chunk += char;
      chunkBytes += charBytes;
    }
  }

  return result + chunk;
}

const JS_DAY_TO_ICS: Record<string, string> = {
  '0': 'SU',
  '1': 'MO',
  '2': 'TU',
  '3': 'WE',
  '4': 'TH',
  '5': 'FR',
  '6': 'SA',
};

/**
 * Build an RRULE from the structured recurrence fields. Falls back to the
 * raw stored recurrence_rule (e.g. from legacy imports) when the structured
 * fields say the event is not recurring.
 */
export function buildRRULE(event: Event): string | undefined {
  const type = event.recurrence_type;

  if (!type || type === 'none') {
    const raw = event.recurrence_rule;
    if (raw && /^FREQ=/i.test(raw.trim())) {
      return raw.trim();
    }
    return undefined;
  }

  let freq: string;
  switch (type) {
    case 'daily':
      freq = 'DAILY';
      break;
    case 'monthly':
      freq = 'MONTHLY';
      break;
    case 'weekly':
    case 'custom':
    default:
      freq = 'WEEKLY';
      break;
  }

  const parts = [`FREQ=${freq}`];

  const interval = Number(event.recurrence_interval);
  if (Number.isFinite(interval) && interval > 1) {
    parts.push(`INTERVAL=${Math.floor(interval)}`);
  }

  if (freq === 'WEEKLY' && Array.isArray(event.recurrence_days) && event.recurrence_days.length > 0) {
    const byday = event.recurrence_days
      .map(d => JS_DAY_TO_ICS[String(d)])
      .filter((code): code is string => !!code);
    if (byday.length > 0) {
      parts.push(`BYDAY=${byday.join(',')}`);
    }
  }

  if (event.recurrence_end_date) {
    // UNTIL must use the same value type as DTSTART (RFC 5545 §3.8.5.3).
    const until = event.is_all_day
      ? toICSDays(event.recurrence_end_date)
      : toICSDateTime(event.recurrence_end_date);
    parts.push(`UNTIL=${until}`);
  }

  return parts.join(';');
}

/** Build a single VEVENT block (list of unfolded content lines). */
function buildVEVENT(event: Event): string[] {
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${event.id}@freecal`,
    `DTSTAMP:${toICSDateTime(new Date().toISOString())}`,
    `SUMMARY:${escapeICSValue(event.title || '(No title)')}`,
  ];

  if (event.is_all_day) {
    const startDays = toICSDays(event.start_time);
    // FreeCal stores all-day end dates as inclusive; ICS DTEND is exclusive
    // (the day after the last day), so add one day. The date is built from
    // parts because 'YYYYMMDD' strings are not parseable by Date directly.
    const endRaw = toICSDays(event.end_time || event.start_time);
    const endUtc = new Date(Date.UTC(
      parseInt(endRaw.slice(0, 4), 10),
      parseInt(endRaw.slice(4, 6), 10) - 1,
      parseInt(endRaw.slice(6, 8), 10)
    ));
    endUtc.setUTCDate(endUtc.getUTCDate() + 1);
    const endDays = `${endUtc.getUTCFullYear()}${pad2(endUtc.getUTCMonth() + 1)}${pad2(endUtc.getUTCDate())}`;

    lines.push(`DTSTART;VALUE=DATE:${startDays}`);
    lines.push(`DTEND;VALUE=DATE:${endDays}`);
  } else {
    lines.push(`DTSTART:${toICSDateTime(event.start_time)}`);
    if (event.end_time) {
      lines.push(`DTEND:${toICSDateTime(event.end_time)}`);
    }
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICSValue(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICSValue(event.location)}`);
  }
  if (event.url && event.url.trim()) {
    lines.push(`URL:${event.url.trim()}`);
  }
  lines.push(`STATUS:${event.is_tentative ? 'TENTATIVE' : 'CONFIRMED'}`);

  const rrule = buildRRULE(event);
  if (rrule) {
    lines.push(`RRULE:${rrule}`);
  }

  const exceptions = Array.isArray(event.recurrence_exceptions)
    ? event.recurrence_exceptions.filter(Boolean)
    : [];
  if (exceptions.length > 0) {
    const exdates = exceptions.map(iso =>
      event.is_all_day ? toICSDays(iso) : toICSDateTime(iso)
    );
    lines.push(`EXDATE${event.is_all_day ? ';VALUE=DATE' : ''}:${exdates.join(',')}`);
  }

  const alerts = Array.isArray(event.alerts) ? event.alerts : [];
  for (const alert of alerts) {
    const minutes = Number(alert.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;

    const trigger = minutes % 60 === 0
      ? `-PT${minutes / 60}H`
      : `-PT${minutes}M`;

    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `TRIGGER:${trigger}`,
      'DESCRIPTION:Reminder',
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/** Serialize one event to a full RFC 5545 VCALENDAR string (CRLF endings). */
export function eventToICS(event: Event): string {
  return eventsToICS([event]);
}

/** Serialize multiple events into a single VCALENDAR string. */
export function eventsToICS(events: Event[]): string {
  if (events.length === 0) return '';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FreeCal//Family Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FreeCal',
  ];

  for (const event of events) {
    lines.push(...buildVEVENT(event));
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Trigger a browser download of an ICS file. */
export function downloadICSFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
