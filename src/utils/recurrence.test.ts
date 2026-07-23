import { expandRecurringEvents } from './recurrence';
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { EventWithAttendees } from '@/lib/api';

// expandRecurringEvents expands in local wall-clock time (DST-safe), so the
// machine timezone influences how the UTC instants in these fixtures map to
// wall-clock days. These tests assert ISO strings derived from UTC ISO
// inputs, so we pin TZ=UTC to keep them deterministic on any machine; with
// TZ=UTC the wall-clock expansion coincides with the original fixed-UTC
// expectations. Node applies process.env.TZ changes at runtime; afterAll
// restores the original zone (Intl reports the system zone when TZ was
// unset) so sibling test files sharing the worker process are unaffected.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'UTC';
afterAll(() => {
    process.env.TZ = ORIGINAL_TZ ?? SYSTEM_TZ;
});

// Builds a minimal EventWithAttendees (same field shape as the fixtures below).
function makeRecurringEvent(overrides: Partial<EventWithAttendees>): EventWithAttendees {
    return {
        id: 'evt-1',
        title: 'Recurring Event',
        start_time: '2026-03-23T09:00:00.000Z',
        end_time: '2026-03-23T10:00:00.000Z',
        recurrence_type: 'weekly',
        recurrence_days: null,
        recurrence_interval: 1,
        recurrence_end_date: null,
        recurrence_exceptions: null,
        recurrence_rule: null,
        user_id: 'u1',
        is_all_day: false,
        color: 'blue',
        attendees: [],
        viewers: [],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        description: null,
        imported_from_device: false,
        location: null,
        url: null,
        is_tentative: false,
        alerts: null,
        travel_time: null,
        original_calendar_id: null,
        structured_metadata: null,
        attendees_details: [],
        isViewer: false,
        ...overrides,
    };
}

describe('expandRecurringEvents', () => {
    it('should expand a weekly event', () => {
        const baseEvent: EventWithAttendees = {
            id: '1',
            title: 'Weekly Meeting',
            start_time: '2024-01-01T10:00:00Z', // Monday
            end_time: '2024-01-01T11:00:00Z',
            recurrence_type: 'weekly',
            recurrence_days: ['1'], // Monday
            recurrence_interval: 1,
            user_id: 'u1',
            is_all_day: false,
            color: 'blue',
            attendees: [],
            viewers: [],
            created_at: '2024-01-01T09:00:00Z',
            updated_at: '2024-01-01T09:00:00Z',
            description: null,
            recurrence_end_date: null,
            recurrence_exceptions: null,
            recurrence_rule: null,
            imported_from_device: false,
            location: null,
            url: null,
            is_tentative: false,
            alerts: null,
            travel_time: null,
            original_calendar_id: null,
            structured_metadata: null,
            attendees_details: [],
            isViewer: false
        };

        const startRange = new Date('2024-01-01T00:00:00Z');
        const endRange = new Date('2024-01-20T00:00:00Z');

        const expanded = expandRecurringEvents([baseEvent], startRange, endRange);

        // Should have 3 occurrences: Jan 1, Jan 8, Jan 15
        expect(expanded.length).toBe(3);
        expect(expanded[0].start_time).toContain('2024-01-01');
        expect(expanded[1].start_time).toContain('2024-01-08');
        expect(expanded[2].start_time).toContain('2024-01-15');
    });

    it('should return original event if not recurring', () => {
        const baseEvent: EventWithAttendees = {
            id: '2',
            title: 'One-off',
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T11:00:00Z',
            recurrence_type: 'none',
            user_id: 'u1',
            is_all_day: false,
            color: 'blue',
            attendees: [],
            viewers: [],
            created_at: '2024-01-01T09:00:00Z',
            updated_at: '2024-01-01T09:00:00Z',
            description: null,
            recurrence_rule: null,
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
            structured_metadata: null,
            attendees_details: [],
            isViewer: false
        };

        const expanded = expandRecurringEvents([baseEvent], new Date('2024-01-01'), new Date('2024-01-02'));
        expect(expanded.length).toBe(1);
        expect(expanded[0].id).toBe('2');
    });

    it('should handle recurrence end date', () => {
        const baseEvent: EventWithAttendees = {
            id: '1',
            title: 'Weekly Meeting',
            start_time: '2024-01-01T10:00:00Z', // Monday
            end_time: '2024-01-01T11:00:00Z',
            recurrence_type: 'weekly',
            recurrence_days: ['1'], // Monday
            recurrence_interval: 1,
            recurrence_end_date: '2024-01-10T00:00:00Z', // Ends after Jan 8th instance
            recurrence_rule: null,
            user_id: 'u1',
            is_all_day: false,
            color: 'blue',
            attendees: [],
            viewers: [],
            created_at: '2024-01-01T09:00:00Z',
            updated_at: '2024-01-01T09:00:00Z',
            description: null,
            recurrence_exceptions: null,
            imported_from_device: false,
            location: null,
            url: null,
            is_tentative: false,
            alerts: null,
            travel_time: null,
            original_calendar_id: null,
            structured_metadata: null,
            attendees_details: [],
            isViewer: false
        };

        const startRange = new Date('2024-01-01T00:00:00Z');
        const endRange = new Date('2024-01-20T00:00:00Z');

        const expanded = expandRecurringEvents([baseEvent], startRange, endRange);

        // Should have 2 occurrences: Jan 1, Jan 8. Jan 15 is after end date.
        expect(expanded.length).toBe(2);
        expect(expanded[0].start_time).toContain('2024-01-01');
        expect(expanded[1].start_time).toContain('2024-01-08');
    });

    it('should filter out excluded occurrences (recurrence_exceptions)', () => {
        const baseEvent = makeRecurringEvent({
            id: 'exc-1',
            start_time: '2024-01-01T10:00:00Z', // Monday
            end_time: '2024-01-01T11:00:00Z',
            recurrence_days: ['1'], // Monday
            // Exclude the Jan 8 instance the same way CalendarView stores it:
            // the ISO timestamp of that occurrence's start_time.
            recurrence_exceptions: ['2024-01-08T10:00:00.000Z'],
        });

        const expanded = expandRecurringEvents(
            [baseEvent],
            new Date('2024-01-01T00:00:00Z'),
            new Date('2024-01-20T00:00:00Z')
        );

        // Jan 1 and Jan 15 remain; Jan 8 is excluded.
        expect(expanded.length).toBe(2);
        expect(expanded[0].start_time).toContain('2024-01-01');
        expect(expanded[1].start_time).toContain('2024-01-15');
    });
});

describe('expandRecurringEvents — DST stability', () => {
    // These tests simulate Europe/Berlin via process.env.TZ (Node applies TZ
    // changes at runtime). Each test restores the previous zone afterwards so
    // sibling test files in the same worker are unaffected.
    // Europe/Berlin springs forward on 2026-03-29 and falls back on 2026-10-25.
    let savedTz: string | undefined;

    beforeEach(() => {
        savedTz = process.env.TZ;
    });

    afterEach(() => {
        process.env.TZ = savedTz ?? SYSTEM_TZ;
    });

    it('keeps a weekly 10:00 event at 10:00 local across the spring-forward boundary (Europe/Berlin)', () => {
        process.env.TZ = 'Europe/Berlin';
        // Guard: the zone must actually observe DST around 2026-03-29,
        // otherwise this test would pass vacuously.
        expect(new Date(2026, 2, 28, 12).getTimezoneOffset()).toBe(-60); // CET
        expect(new Date(2026, 2, 30, 12).getTimezoneOffset()).toBe(-120); // CEST

        // Monday 2026-03-23 10:00 Berlin (CET) = 09:00Z; one hour duration.
        const event = makeRecurringEvent({
            start_time: '2026-03-23T09:00:00.000Z',
            end_time: '2026-03-23T10:00:00.000Z',
            recurrence_type: 'weekly',
            recurrence_days: ['1'], // Monday
        });

        const expanded = expandRecurringEvents(
            [event],
            new Date(2026, 2, 1),             // local Mar 1
            new Date(2026, 3, 30, 23, 59, 59) // local Apr 30
        );

        // Mondays: Mar 23, Mar 30, Apr 6, Apr 13, Apr 20, Apr 27
        expect(expanded.length).toBe(6);
        for (const occ of expanded) {
            const start = new Date(occ.start_time);
            const end = new Date(occ.end_time);
            expect(start.getHours()).toBe(10);
            expect(start.getMinutes()).toBe(0);
            expect(end.getHours()).toBe(11);
        }
        // Before the fix, occurrences after 2026-03-29 stayed at 09:00Z and
        // therefore displayed as 11:00 local. They must now shift to 08:00Z
        // to remain at 10:00 CEST.
        expect(expanded[0].start_time).toBe('2026-03-23T09:00:00.000Z');
        expect(expanded[1].start_time).toBe('2026-03-30T08:00:00.000Z');
        expect(expanded[5].start_time).toBe('2026-04-27T08:00:00.000Z');
    });

    it('keeps a daily 09:30 event at 09:30 local across the fall-back boundary (Europe/Berlin)', () => {
        process.env.TZ = 'Europe/Berlin';
        // Guard: 2026-10-25 is the fall-back day.
        expect(new Date(2026, 9, 24, 12).getTimezoneOffset()).toBe(-120); // CEST
        expect(new Date(2026, 9, 26, 12).getTimezoneOffset()).toBe(-60); // CET

        // 2026-10-20 09:30 Berlin (CEST) = 07:30Z; 30 minute duration.
        const event = makeRecurringEvent({
            id: 'dst-2',
            start_time: '2026-10-20T07:30:00.000Z',
            end_time: '2026-10-20T08:00:00.000Z',
            recurrence_type: 'daily',
        });

        const expanded = expandRecurringEvents(
            [event],
            new Date(2026, 9, 20),             // local Oct 20
            new Date(2026, 10, 3, 23, 59, 59)  // local Nov 3
        );

        // Daily from Oct 20 through Nov 3 inclusive.
        expect(expanded.length).toBe(15);
        for (const occ of expanded) {
            const start = new Date(occ.start_time);
            expect(start.getHours()).toBe(9);
            expect(start.getMinutes()).toBe(30);
        }
        // Before the fix, instances after fall-back stayed at 07:30Z = 08:30
        // local. They must now shift to 08:30Z to remain at 09:30 CET.
        expect(expanded[0].start_time).toBe('2026-10-20T07:30:00.000Z');
        const nov3 = expanded.find(e => e.start_time.includes('2026-11-03'));
        expect(nov3?.start_time).toBe('2026-11-03T08:30:00.000Z');
    });

    it('keeps local wall-clock time under the system timezone, whatever it is', () => {
        // Machine-zone agnostic: the fixture is built from local components,
        // so it is valid in any zone. March/April 2026 spans a DST transition
        // in every zone that observes one (EU: Mar 29, US: Mar 8); in zones
        // without DST the assertion still verifies wall-clock stability.
        process.env.TZ = SYSTEM_TZ;

        const event = makeRecurringEvent({
            id: 'dst-3',
            start_time: new Date(2026, 2, 20, 10, 0).toISOString(), // local Friday 10:00
            end_time: new Date(2026, 2, 20, 11, 0).toISOString(),
            recurrence_type: 'weekly',
            recurrence_days: ['5'], // Friday
        });

        const expanded = expandRecurringEvents(
            [event],
            new Date(2026, 2, 1),
            new Date(2026, 3, 30, 23, 59, 59)
        );

        // Fridays: Mar 20, Mar 27, Apr 3, Apr 10, Apr 17, Apr 24
        expect(expanded.length).toBe(6);
        for (const occ of expanded) {
            const start = new Date(occ.start_time);
            expect(start.getDay()).toBe(5);
            expect(start.getHours()).toBe(10);
            expect(start.getMinutes()).toBe(0);
        }
    });
});
