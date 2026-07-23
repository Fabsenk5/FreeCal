import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { parseICS } from './icsParser';

// parseICS converts Z-suffixed UTC times to local time, so results depend on
// the machine timezone. This file pins TZ=UTC, which makes the UTC->local
// conversion the identity and matches the fixtures below (e.g.
// '20240101T100000Z' -> '10:00'). Tests that exercise real timezone
// conversion switch TZ explicitly and restore it afterwards. Node applies
// process.env.TZ changes at runtime; afterAll restores the original zone
// (Intl reports the system zone when TZ was unset).
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'UTC';
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ ?? SYSTEM_TZ;
});

describe('ICS Parser', () => {
  it('should parse simple event', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Test Meeting
DESCRIPTION:Test Description
LOCATION:Room 123
URL:https://example.com
UID:test-1
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.title).toBe('Test Meeting');
    expect(event?.description).toBe('Test Description');
    expect(event?.location).toBe('Room 123');
    expect(event?.url).toBe('https://example.com');
    expect(event?.isAllDay).toBe(false);
    expect(event?.startDate).toBe('2024-01-01');
    expect(event?.startTime).toBe('10:00');
    expect(event?.endDate).toBe('2024-01-01');
    expect(event?.endTime).toBe('11:00');
  });

  it('should parse all-day event', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240101
DTEND;VALUE=DATE:20240102
SUMMARY:All Day Event
UID:test-2
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.isAllDay).toBe(true);
    expect(event?.title).toBe('All Day Event');
    expect(event?.startDate).toBe('2024-01-01');
    expect(event?.startTime).toBeUndefined();
  });

  it('should parse event with attendees', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Meeting with Attendees
ATTENDEE;CN=John Doe:mailto:john@example.com
ATTENDEE;CN=Jane Smith:mailto:jane@example.com
UID:test-3
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.attendees).toBeDefined();
    expect(event?.attendees?.length).toBe(2);
    expect(event?.attendees?.[0].name).toBe('John Doe');
    expect(event?.attendees?.[0].email).toBe('john@example.com');
    expect(event?.attendees?.[1].name).toBe('Jane Smith');
    expect(event?.attendees?.[1].email).toBe('jane@example.com');
  });

  it('should parse event with alarms', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Event with Alarms
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:1 hour reminder
END:VALARM
UID:test-4
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.alerts).toBeDefined();
    expect(event?.alerts?.length).toBe(2);
    expect(event?.alerts?.[0].minutes).toBe(15);
    expect(event?.alerts?.[1].minutes).toBe(60);
  });

  it('should parse event with recurrence', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Recurring Event
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
UID:test-5
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('should parse tentative event', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
SUMMARY:Tentative Event
STATUS:TENTATIVE
UID:test-6
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.isTentative).toBe(true);
  });

  it('should return null for invalid ICS', () => {
    const ics = 'INVALID ICS CONTENT';
    const event = parseICS(ics);
    expect(event).toBeNull();
  });

  it('should handle ICS with Windows line endings', () => {
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:20240101T100000Z\r\nDTEND:20240101T110000Z\r\nSUMMARY:Test Event\r\nUID:test-7\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    
    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.title).toBe('Test Event');
  });

  it('should parse event with complex data', () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T140000Z
DTEND:20240115T160000Z
SUMMARY:Quarterly Business Review
DESCRIPTION:Q1 2024 review with all teams
LOCATION:Conference Room A - Building 2
URL:https://zoom.us/j/123456789?pwd=abc
ATTENDEE;CN=Alice Johnson:mailto:alice@company.com
ATTENDEE;CN=Bob Williams:mailto:bob@company.com
ATTENDEE;CN=Carol Davis:mailto:carol@company.com
BEGIN:VALARM
TRIGGER:-PT30M
ACTION:DISPLAY
DESCRIPTION:Meeting in 30 minutes
END:VALARM
BEGIN:VALARM
TRIGGER:-PT5M
ACTION:DISPLAY
DESCRIPTION:Meeting in 5 minutes
END:VALARM
RRULE:FREQ=QUARTERLY;BYMONTH=1,4,7,10
STATUS:CONFIRMED
UID:qbr-2024-q1
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.title).toBe('Quarterly Business Review');
    expect(event?.attendees?.length).toBe(3);
    expect(event?.alerts?.length).toBe(2);
    expect(event?.recurrenceRule).toBe('FREQ=QUARTERLY;BYMONTH=1,4,7,10');
    expect(event?.isTentative).toBe(false);
  });
});

describe('ICS Parser — timezones', () => {
  // Each test sets the zone it needs and restores the previous one
  // afterwards, so sibling test files in the same worker are unaffected.
  let savedTz: string | undefined;

  beforeEach(() => {
    savedTz = process.env.TZ;
  });

  afterEach(() => {
    process.env.TZ = savedTz ?? SYSTEM_TZ;
  });

  it('converts Z-suffixed UTC times to local time (Europe/Berlin)', () => {
    process.env.TZ = 'Europe/Berlin';
    // Guard: Berlin is UTC+1 in January — otherwise this test is vacuous.
    expect(new Date('2024-01-15T12:00:00Z').getHours()).toBe(13);

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T090000Z
DTEND:20240115T103000Z
SUMMARY:UTC Event
UID:tz-1
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.startDate).toBe('2024-01-15');
    expect(event?.startTime).toBe('10:00'); // 09:00 UTC = 10:00 CET
    expect(event?.endDate).toBe('2024-01-15');
    expect(event?.endTime).toBe('11:30');
  });

  it('shifts the local date when UTC conversion crosses midnight', () => {
    process.env.TZ = 'Europe/Berlin';

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240115T233000Z
DTEND:20240116T003000Z
SUMMARY:Late UTC Event
UID:tz-2
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    // 23:30 UTC = 00:30 next day CET — the wall-clock date must move along.
    expect(event?.startDate).toBe('2024-01-16');
    expect(event?.startTime).toBe('00:30');
    expect(event?.endDate).toBe('2024-01-16');
    expect(event?.endTime).toBe('01:30');
  });

  it('passes TZID wall clock through unchanged and exposes the TZID', () => {
    // TZID values are deliberately NOT re-zoned (see parser comment): the
    // exported wall clock is kept and the TZID is only reported. Verified
    // under a non-UTC zone to prove no hidden conversion happens.
    process.env.TZ = 'America/New_York';

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;TZID=Europe/Berlin:20240315T100000
DTEND;TZID=Europe/Berlin:20240315T110000
SUMMARY:Zoned Event
UID:tz-3
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.startDate).toBe('2024-03-15');
    expect(event?.startTime).toBe('10:00');
    expect(event?.endTime).toBe('11:00');
    expect(event?.timezone).toBe('Europe/Berlin');
  });

  it('treats floating times (no Z, no TZID) as wall clock in any zone', () => {
    process.env.TZ = 'America/New_York';

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240101T100000
DTEND:20240101T110000
SUMMARY:Floating Event
UID:tz-4
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event?.startTime).toBe('10:00');
    expect(event?.endTime).toBe('11:00');
    expect(event?.timezone).toBeUndefined();
  });

  it('does not shift DATE-only all-day events across timezones', () => {
    process.env.TZ = 'Europe/Berlin';

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20241026
DTEND;VALUE=DATE:20241028
SUMMARY:All Day Multi
UID:tz-5
END:VEVENT
END:VCALENDAR`;

    const event = parseICS(ics);
    expect(event).toBeDefined();
    expect(event?.isAllDay).toBe(true);
    expect(event?.startDate).toBe('2024-10-26');
    expect(event?.endDate).toBe('2024-10-28');
    expect(event?.startTime).toBeUndefined();
    expect(event?.endTime).toBeUndefined();
    expect(event?.timezone).toBeUndefined();
  });
});

describe('ICS Parser — RRULE BYDAY', () => {
  const icsWithRRule = (rrule: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20240105T100000Z
DTEND:20240105T110000Z
SUMMARY:Recurring
RRULE:${rrule}
UID:byday-test
END:VEVENT
END:VCALENDAR`;

  it('extracts multiple BYDAY codes', () => {
    const event = parseICS(icsWithRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR'));
    expect(event?.byday).toEqual(['MO', 'WE', 'FR']);
  });

  it('extracts a single BYDAY code', () => {
    const event = parseICS(icsWithRRule('FREQ=WEEKLY;BYDAY=FR'));
    expect(event?.byday).toEqual(['FR']);
  });

  it('reduces ordinal BYDAY codes of monthly rules to the weekday code', () => {
    const event = parseICS(icsWithRRule('FREQ=MONTHLY;BYDAY=1MO,-1FR'));
    expect(event?.byday).toEqual(['MO', 'FR']);
  });

  it('leaves byday undefined when BYDAY is absent', () => {
    const event = parseICS(icsWithRRule('FREQ=WEEKLY;INTERVAL=2'));
    expect(event?.byday).toBeUndefined();
    expect(event?.recurrenceRule).toBe('FREQ=WEEKLY;INTERVAL=2');
  });
});
