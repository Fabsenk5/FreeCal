import { describe, it, expect, afterAll } from 'vitest';
import { eventToICS, eventsToICS, escapeICSValue, buildRRULE } from './icsGenerator';
import { parseICS, parseMultipleICS } from './icsParser';
import type { Event } from '@/lib/api';

// The generator emits UTC date-times; pinning TZ=UTC makes the parseICS
// round-trip conversion the identity (same pattern as icsParser.test.ts).
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'UTC';
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ ?? SYSTEM_TZ;
});

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    user_id: 'user-1',
    title: 'Test Event',
    description: null,
    start_time: '2024-01-15T09:00:00.000Z',
    end_time: '2024-01-15T10:00:00.000Z',
    is_all_day: false,
    color: '#fff',
    recurrence_rule: null,
    recurrence_type: 'none',
    recurrence_days: null,
    recurrence_interval: null,
    recurrence_end_date: null,
    recurrence_exceptions: null,
    imported_from_device: false,
    location: null,
    url: null,
    is_tentative: false,
    alerts: null,
    travel_time: null,
    original_calendar_id: null,
    attendees: null,
    structured_metadata: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ICS Generator', () => {
  it('exports a timed event with CRLF endings and UTC date-times', () => {
    const ics = eventToICS(makeEvent({
      title: 'Test Meeting',
      description: 'Test Description',
      location: 'Room 123',
      url: 'https://example.com',
    }));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('UID:evt-1@freecal');
    expect(ics).toContain('DTSTART:20240115T090000Z');
    expect(ics).toContain('DTEND:20240115T100000Z');
    expect(ics).toContain('STATUS:CONFIRMED');
    expect(ics).toContain('END:VEVENT');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('round-trips a timed event through the parser', () => {
    const event = makeEvent({
      title: 'Test Meeting',
      description: 'Test Description',
      location: 'Room 123',
      url: 'https://example.com',
    });

    const parsed = parseICS(eventToICS(event));
    expect(parsed).toBeDefined();
    expect(parsed?.title).toBe('Test Meeting');
    expect(parsed?.description).toBe('Test Description');
    expect(parsed?.location).toBe('Room 123');
    expect(parsed?.url).toBe('https://example.com');
    expect(parsed?.isAllDay).toBe(false);
    expect(parsed?.startDate).toBe('2024-01-15');
    expect(parsed?.startTime).toBe('09:00');
    expect(parsed?.endDate).toBe('2024-01-15');
    expect(parsed?.endTime).toBe('10:00');
  });

  it('exports all-day events with VALUE=DATE and an exclusive DTEND', () => {
    // FreeCal end date is inclusive (Jan 1..3) -> ICS DTEND must be Jan 4.
    const ics = eventToICS(makeEvent({
      title: 'Vacation',
      is_all_day: true,
      start_time: '2024-01-01T00:00:00.000Z',
      end_time: '2024-01-03T00:00:00.000Z',
    }));

    expect(ics).toContain('DTSTART;VALUE=DATE:20240101');
    expect(ics).toContain('DTEND;VALUE=DATE:20240104');

    const parsed = parseICS(ics);
    expect(parsed?.isAllDay).toBe(true);
    expect(parsed?.startDate).toBe('2024-01-01');
    expect(parsed?.endDate).toBe('2024-01-03');
    expect(parsed?.startTime).toBeUndefined();
  });

  it('escapes TEXT values and round-trips them through the parser', () => {
    const title = 'Team; Meeting, "Q1" \\ 2024';
    const description = 'Line one\nLine two';

    const ics = eventToICS(makeEvent({ title, description }));

    expect(ics).toContain('SUMMARY:Team\\; Meeting\\, "Q1" \\\\ 2024');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two');

    const parsed = parseICS(ics);
    expect(parsed?.title).toBe(title);
    expect(parsed?.description).toBe(description);
  });

  it('builds a weekly RRULE with interval, days and until', () => {
    const event = makeEvent({
      recurrence_type: 'weekly',
      recurrence_days: ['1', '3', '5'],
      recurrence_interval: 2,
      recurrence_end_date: '2024-05-01T00:00:00.000Z',
    });

    const ics = eventToICS(event);
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;UNTIL=20240501T000000Z');

    const parsed = parseICS(ics);
    expect(parsed?.recurrenceRule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;UNTIL=20240501T000000Z');
  });

  it('uses a DATE-valued UNTIL for all-day recurrence', () => {
    const ics = eventToICS(makeEvent({
      title: 'Daily',
      is_all_day: true,
      start_time: '2024-02-01T00:00:00.000Z',
      end_time: '2024-02-01T00:00:00.000Z',
      recurrence_type: 'daily',
      recurrence_end_date: '2024-02-29T00:00:00.000Z',
    }));

    expect(ics).toContain('RRULE:FREQ=DAILY;UNTIL=20240229');
  });

  it('falls back to the raw recurrence_rule when structured fields are absent', () => {
    const event = makeEvent({
      recurrence_type: 'none',
      recurrence_rule: 'FREQ=YEARLY;BYMONTH=1',
    });

    expect(buildRRULE(event)).toBe('FREQ=YEARLY;BYMONTH=1');
    expect(buildRRULE(makeEvent())).toBeUndefined();
  });

  it('exports recurrence exceptions as EXDATE', () => {
    const ics = eventToICS(makeEvent({
      recurrence_type: 'weekly',
      recurrence_days: ['1'],
      recurrence_exceptions: ['2024-01-22T09:00:00.000Z', '2024-01-29T09:00:00.000Z'],
    }));

    expect(ics).toContain('EXDATE:20240122T090000Z,20240129T090000Z');
  });

  it('exports alarms with minute/hour triggers', () => {
    const ics = eventToICS(makeEvent({
      alerts: [{ type: 'DISPLAY', minutes: 15 }, { type: 'DISPLAY', minutes: 60 }],
    }));

    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('TRIGGER:-PT1H');

    const parsed = parseICS(ics);
    expect(parsed?.alerts?.length).toBe(2);
    expect(parsed?.alerts?.[0].minutes).toBe(15);
    expect(parsed?.alerts?.[1].minutes).toBe(60);
  });

  it('marks tentative events with STATUS:TENTATIVE', () => {
    const ics = eventToICS(makeEvent({ is_tentative: true }));

    expect(ics).toContain('STATUS:TENTATIVE');

    const parsed = parseICS(ics);
    expect(parsed?.isTentative).toBe(true);
  });

  it('folds long lines at 75 octets with CRLF continuations', () => {
    const longDescription = 'x'.repeat(200);
    const ics = eventToICS(makeEvent({
      description: `${longDescription} with some ünïcode`,
    }));

    const lines = ics.split('\r\n');
    expect(lines.some(l => l.startsWith('DESCRIPTION:'))).toBe(true);
    for (const line of lines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    // No stray lone-\n line endings.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('exports multiple events into one VCALENDAR', () => {
    const ics = eventsToICS([
      makeEvent({ id: 'a', title: 'One' }),
      makeEvent({ id: 'b', title: 'Two' }),
    ]);

    expect(ics).toContain('UID:a@freecal');
    expect(ics).toContain('UID:b@freecal');

    const parsed = parseMultipleICS(ics);
    expect(parsed.length).toBe(2);
    expect(parsed[0].title).toBe('One');
    expect(parsed[1].title).toBe('Two');
  });

  it('returns an empty string for an empty event list', () => {
    expect(eventsToICS([])).toBe('');
  });

  it('escapes control characters in escapeICSValue', () => {
    expect(escapeICSValue('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});
