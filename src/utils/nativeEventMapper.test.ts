import { describe, it, expect, afterAll } from 'vitest';
import {
  nativeEventToParsedEvent,
  nativeRecurrenceToRRULE,
} from './nativeEventMapper';
import type { NativeCalendarEvent, NativeRecurrenceRule } from '@/lib/nativeBridge';

// The mapper converts UTC timestamps to local wall clock; pin TZ=UTC like the
// other timezone-sensitive test files.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'UTC';
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ ?? SYSTEM_TZ;
});

function makeEvent(overrides: Partial<NativeCalendarEvent> = {}): NativeCalendarEvent {
  return {
    id: 'native-1',
    calendarId: 'cal-1',
    title: 'iOS Event',
    startDate: '2026-08-05T09:00:00.000Z',
    endDate: '2026-08-05T10:30:00.000Z',
    allDay: false,
    ...overrides,
  };
}

describe('nativeRecurrenceToRRULE', () => {
  it('maps a weekly rule with days of the week (1 = Sunday)', () => {
    const rule: NativeRecurrenceRule = {
      frequency: 'WEEKLY',
      daysOfTheWeek: [
        { dayOfTheWeek: 2 },
        { dayOfTheWeek: 4 },
        { dayOfTheWeek: 6 },
      ],
    };
    expect(nativeRecurrenceToRRULE(rule)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('maps Saturday correctly (7) and tolerates 0-based input', () => {
    expect(nativeRecurrenceToRRULE({ frequency: 'weekly', daysOfTheWeek: [{ dayOfTheWeek: 7 }] }))
      .toBe('FREQ=WEEKLY;BYDAY=SA');
    expect(nativeRecurrenceToRRULE({ frequency: 'weekly', daysOfTheWeek: [{ dayOfTheWeek: 0 }] }))
      .toBe('FREQ=WEEKLY;BYDAY=SU');
  });

  it('maps ordinal week numbers (nth weekday) into BYDAY', () => {
    const rule: NativeRecurrenceRule = {
      frequency: 'MONTHLY',
      daysOfTheWeek: [
        { dayOfTheWeek: 2, weekNumber: 2 },
        { dayOfTheWeek: 6, weekNumber: -1 },
      ],
    };
    expect(nativeRecurrenceToRRULE(rule)).toBe('FREQ=MONTHLY;BYDAY=2MO,-1FR');
  });

  it('maps monthly days and yearly months', () => {
    expect(nativeRecurrenceToRRULE({ frequency: 'MONTHLY', daysOfTheMonth: [1, 15] }))
      .toBe('FREQ=MONTHLY;BYMONTHDAY=1,15');
    expect(nativeRecurrenceToRRULE({ frequency: 'YEARLY', monthsOfTheYear: [1, 7] }))
      .toBe('FREQ=YEARLY;BYMONTH=1,7');
  });

  it('maps interval, endDate (UNTIL) and occurrence (COUNT)', () => {
    const rule: NativeRecurrenceRule = {
      frequency: 'WEEKLY',
      interval: 2,
      daysOfTheWeek: [{ dayOfTheWeek: 2 }],
      endDate: '2026-12-31T23:59:59.000Z',
      occurrence: 10,
    };
    expect(nativeRecurrenceToRRULE(rule)).toBe(
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=20261231T235959Z;COUNT=10'
    );
  });

  it('returns undefined for missing or unknown rules', () => {
    expect(nativeRecurrenceToRRULE(null)).toBeUndefined();
    expect(nativeRecurrenceToRRULE({ frequency: 'ALWAYS' })).toBeUndefined();
  });
});

describe('nativeEventToParsedEvent', () => {
  it('maps a timed event to local wall clock', () => {
    const parsed = nativeEventToParsedEvent(makeEvent());
    expect(parsed.title).toBe('iOS Event');
    expect(parsed.isAllDay).toBe(false);
    expect(parsed.startDate).toBe('2026-08-05');
    expect(parsed.startTime).toBe('09:00');
    expect(parsed.endDate).toBe('2026-08-05');
    expect(parsed.endTime).toBe('10:30');
  });

  it('maps all-day events and normalizes the exclusive end date', () => {
    const parsed = nativeEventToParsedEvent(
      makeEvent({
        allDay: true,
        startDate: '2026-08-05T00:00:00.000Z',
        endDate: '2026-08-07T00:00:00.000Z',
      })
    );
    expect(parsed.isAllDay).toBe(true);
    expect(parsed.startDate).toBe('2026-08-05');
    expect(parsed.endDate).toBe('2026-08-06');
    expect(parsed.startTime).toBeUndefined();
    expect(parsed.endTime).toBeUndefined();
  });

  it('keeps single-day all-day events on the start date', () => {
    const parsed = nativeEventToParsedEvent(
      makeEvent({
        allDay: true,
        startDate: '2026-08-05T00:00:00.000Z',
        endDate: '2026-08-06T00:00:00.000Z',
      })
    );
    expect(parsed.startDate).toBe('2026-08-05');
    expect(parsed.endDate).toBe('2026-08-05');
  });

  it('maps recurrence, alarms and tentative status', () => {
    const parsed = nativeEventToParsedEvent(
      makeEvent({
        status: 'TENTATIVE',
        alarms: [{ relativeOffset: -15 }, { relativeOffset: -60 }, { relativeOffset: 5 }],
        recurrenceRule: { frequency: 'WEEKLY', daysOfTheWeek: [{ dayOfTheWeek: 2 }] },
      })
    );
    expect(parsed.isTentative).toBe(true);
    expect(parsed.alerts).toEqual([
      { minutes: 15, type: 'DISPLAY' },
      { minutes: 60, type: 'DISPLAY' },
    ]);
    expect(parsed.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO');
  });

  it('maps location, notes and url', () => {
    const parsed = nativeEventToParsedEvent(
      makeEvent({ location: 'Room 1', notes: 'Bring laptop', url: 'https://meet.example.com' })
    );
    expect(parsed.location).toBe('Room 1');
    expect(parsed.description).toBe('Bring laptop');
    expect(parsed.url).toBe('https://meet.example.com');
  });
});
