/**
 * ICS (iCalendar) Parser for importing calendar events
 * Supports parsing iOS calendar exported events
 */

export interface ParsedEvent {
  title: string;
  description?: string;
  /** 'YYYY-MM-DD', local wall clock of the event (UTC values are converted). */
  startDate: string;
  /** 'YYYY-MM-DD', local wall clock of the event (UTC values are converted). */
  endDate: string;
  /** 'HH:MM' (24h), local wall clock; undefined for all-day events. */
  startTime?: string;
  /** 'HH:MM' (24h), local wall clock; undefined for all-day events. */
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  url?: string;
  /** Raw RRULE value, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR'. */
  recurrenceRule?: string;
  /**
   * Weekday codes extracted from the RRULE BYDAY part ('MO'..'SU'), e.g.
   * ['MO', 'WE', 'FR']. Ordinal prefixes of monthly rules ('1MO', '-1FR')
   * are reduced to the plain weekday code. Undefined when BYDAY is absent —
   * consumers should then fall back to the weekday of startDate for WEEKLY.
   */
  byday?: string[];
  attendees?: Array<{ name: string; email: string }>;
  alerts?: Array<{ minutes: number; type: string }>;
  /**
   * TZID parameter of DTSTART (e.g. 'Europe/Berlin'), if present. The event
   * times are passed through as wall clock (see parser note on TZID), this
   * field only informs the consumer which zone the export declared.
   */
  timezone?: string;
  originalCalendarId?: string;
  isTentative?: boolean;
  travelTime?: number; // in minutes
}

/** A single unfolded iCalendar content line, split into its parts. */
interface ICSProperty {
  /** Uppercased property name without parameters, e.g. 'DTSTART'. */
  name: string;
  /** Raw parameter string, original case, e.g. 'TZID=Europe/Berlin'. */
  params: string;
  /** Unfolded value after the first colon. */
  value: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Unescape a TEXT property value per RFC 5545 (§3.3.11): \n -> newline,
 * \\ -> backslash, \; -> semicolon, \, -> comma. Scans left to right so that
 * an escaped backslash followed by 'n' (literal '\n' text) is not mistaken
 * for a newline.
 */
export function unescapeICSValue(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === 'n' || next === 'N') {
        result += '\n';
        i++;
        continue;
      }
      if (next === '\\') {
        result += '\\';
        i++;
        continue;
      }
      if (next === ';') {
        result += ';';
        i++;
        continue;
      }
      if (next === ',') {
        result += ',';
        i++;
        continue;
      }
    }
    result += ch;
  }
  return result;
}

export function parseICS(icsContent: string): ParsedEvent | null {
  try {
    // Normalize line breaks
    const normalized = icsContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Extract VEVENT block
    const eventMatch = normalized.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
    if (!eventMatch) {
      console.error('No VEVENT found in ICS');
      return null;
    }

    const eventData = eventMatch[1];
    const lines = eventData.split('\n');
    const properties: ICSProperty[] = [];

    // Parse properties (handle line folding)
    let currentKey = '';
    let currentValue = '';

    const pushProperty = (rawKey: string, value: string) => {
      if (!rawKey) return;
      const semicolonIndex = rawKey.indexOf(';');
      const name = (semicolonIndex === -1 ? rawKey : rawKey.substring(0, semicolonIndex)).toUpperCase();
      const params = semicolonIndex === -1 ? '' : rawKey.substring(semicolonIndex + 1);
      properties.push({ name, params, value });
    };

    for (const line of lines) {
      if (line.match(/^\s/) && currentKey) {
        // Continuation of previous line
        currentValue += line.substring(1);
      } else {
        pushProperty(currentKey, currentValue);

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
          currentKey = '';
          currentValue = '';
          continue;
        }

        currentKey = line.substring(0, colonIndex);
        currentValue = line.substring(colonIndex + 1);
      }
    }

    // Add last property
    pushProperty(currentKey, currentValue);

    // Helper functions to access properties by (parameter-less) name
    const getProperty = (key: string): string | undefined => {
      return properties.find(p => p.name === key)?.value;
    };

    const getPropertyParams = (key: string): string | undefined => {
      return properties.find(p => p.name === key)?.params;
    };

    const getPropertyObjects = (key: string): ICSProperty[] => {
      return properties.filter(p => p.name === key);
    };

    // Parse main properties (TEXT values are unescaped per RFC 5545)
    const summary = unescapeICSValue(getProperty('SUMMARY') || '');
    const description = unescapeICSValue(getProperty('DESCRIPTION') || '');
    const location = unescapeICSValue(getProperty('LOCATION') || '');
    const url = getProperty('URL') || '';
    const rrule = getProperty('RRULE') || '';
    const transp = getProperty('TRANSP') || 'OPAQUE';
    const status = getProperty('STATUS') || 'CONFIRMED';

    // Parse dates
    const dtstart = getProperty('DTSTART') || '';
    const dtend = getProperty('DTEND') || '';
    const dtstartParams = getPropertyParams('DTSTART') || '';

    // TZID of DTSTART, original case preserved (e.g. 'Europe/Berlin').
    const tzid = dtstartParams.match(/TZID=([^;:]+)/i)?.[1];

    // Check if all-day: VALUE=DATE parameter (but not VALUE=DATE-TIME, which
    // shares the prefix) or a date value without a time component.
    const isAllDay = /VALUE=DATE(?!-TIME)/i.test(dtstartParams) || !dtstart.includes('T');

    // Extracts local wall-clock date/time from a DATE-TIME value.
    // - 'Z' suffix: the value is UTC and is converted to the local timezone
    //   (the wall-clock date may shift across midnight).
    // - TZID parameter or floating (no suffix): the wall clock is taken over
    //   unchanged. Simplification: TZID values are NOT re-zoned to the device
    //   timezone — for personal calendars the exported wall clock is almost
    //   always what the user expects, and there is no IANA timezone
    //   calculator in this codebase.
    const parseDateTime = (value: string): { date: string; time: string } | null => {
      const match = value.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
      if (!match) return null;

      if (/Z$/i.test(value.trim())) {
        const utc = new Date(Date.UTC(
          parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10),
          parseInt(match[4], 10), parseInt(match[5], 10), parseInt(match[6], 10)
        ));
        return {
          date: `${utc.getFullYear()}-${pad2(utc.getMonth() + 1)}-${pad2(utc.getDate())}`,
          time: `${pad2(utc.getHours())}:${pad2(utc.getMinutes())}`,
        };
      }

      return {
        date: `${match[1]}-${match[2]}-${match[3]}`,
        time: `${match[4]}:${match[5]}`,
      };
    };

    let startDate = '';
    let startTime = '';
    let endDate = '';
    let endTime = '';

    if (isAllDay) {
      // Format: 20231225 — calendar dates, never shifted by timezones.
      const startMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})/);
      const endMatch = dtend.match(/(\d{4})(\d{2})(\d{2})/);

      if (startMatch) {
        startDate = `${startMatch[1]}-${startMatch[2]}-${startMatch[3]}`;
      }
      if (endMatch) {
        endDate = `${endMatch[1]}-${endMatch[2]}-${endMatch[3]}`;
      }
      // RFC 5545: for all-day events DTEND is exclusive — the day AFTER the
      // last day (Apple and Google both export it that way). Normalize it to
      // the inclusive last day the app expects.
      if (endDate && endDate !== startDate) {
        const endUtc = new Date(`${endDate}T00:00:00Z`);
        endUtc.setUTCDate(endUtc.getUTCDate() - 1);
        endDate = `${endUtc.getUTCFullYear()}-${pad2(endUtc.getUTCMonth() + 1)}-${pad2(endUtc.getUTCDate())}`;
      }
    } else {
      // Format: 20231225T100000Z (UTC), 20231225T100000 (floating) or
      // DTSTART;TZID=...:20231225T100000 (zoned wall clock)
      const start = parseDateTime(dtstart);
      const end = dtend ? parseDateTime(dtend) : null;

      if (start) {
        startDate = start.date;
        startTime = start.time;
      }
      if (end) {
        endDate = end.date;
        endTime = end.time;
      }
    }

    // Extract BYDAY weekday codes from the RRULE (e.g. 'BYDAY=MO,WE,FR' ->
    // ['MO', 'WE', 'FR']). Ordinal prefixes used by monthly rules ('1MO',
    // '-1FR') are reduced to the plain weekday code.
    const bydayMatch = rrule.match(/BYDAY=([^;:]+)/i);
    const byday = bydayMatch
      ? bydayMatch[1].split(',')
        .map(day => day.trim().match(/(MO|TU|WE|TH|FR|SA|SU)$/i)?.[1]?.toUpperCase())
        .filter((day): day is string => !!day)
      : [];

    // Parse attendees (CN lives in the parameters, the address in the value)
    const attendees = getPropertyObjects('ATTENDEE').map((prop) => {
      const emailMatch = prop.value.match(/mailto:([^\s;]+)/i);
      const nameMatch = prop.params.match(/CN=([^;:]+)/i);
      const email = emailMatch?.[1] || '';
      const name = nameMatch?.[1].replace(/^"|"$/g, '').trim() || email;
      return { email, name };
    }).filter(a => a.email);

    // Parse alarms (VALARM blocks)
    const alarmMatch = normalized.match(/BEGIN:VALARM([\s\S]*?)END:VALARM/g) || [];
    const alerts = alarmMatch.map((alarm) => {
      const triggerMatch = alarm.match(/TRIGGER:(-?)PT(\d+)([MH])/);
      if (!triggerMatch) return null;

      const sign = triggerMatch[1] === '-' ? -1 : 1;
      let minutes = parseInt(triggerMatch[2]) * sign;

      if (triggerMatch[3] === 'H') {
        minutes *= 60;
      }

      return {
        minutes: Math.abs(minutes),
        type: 'DISPLAY',
      };
    }).filter((a): a is { minutes: number; type: string } => a !== null);

    // Parse TRANSP to determine if tentative
    const isTentative = status === 'TENTATIVE';

    // Build parsed event
    const parsedEvent: ParsedEvent = {
      title: summary,
      description: description || undefined,
      location: location || undefined,
      url: url || undefined,
      startDate,
      endDate: endDate || startDate,
      startTime: !isAllDay ? startTime : undefined,
      endTime: !isAllDay ? endTime : undefined,
      isAllDay,
      recurrenceRule: rrule || undefined,
      byday: byday.length > 0 ? byday : undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      alerts: alerts.length > 0 ? alerts : undefined,
      timezone: tzid || undefined,
      isTentative,
    };

    return parsedEvent;
  } catch (error) {
    console.error('Error parsing ICS:', error);
    return null;
  }
}

/**
 * Parse multiple events from ICS content
 */
export function parseMultipleICS(icsContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const eventMatches = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  for (const eventBlock of eventMatches) {
    const fullICS = icsContent.substring(0, icsContent.indexOf('BEGIN:VEVENT')) + eventBlock;
    const parsed = parseICS(fullICS);
    if (parsed) {
      events.push(parsed);
    }
  }

  return events;
}
