import { describe, it, expect } from 'vitest';
import { parseICS } from './icsParser';

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
