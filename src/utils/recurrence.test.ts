import { expandRecurringEvents } from './recurrence';
import { describe, it, expect } from 'vitest';
import { EventWithAttendees } from '@/lib/api';

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
            imported_from_device: false,
            location: null,
            url: null,
            is_tentative: false,
            alerts: null,
            travel_time: null,
            original_calendar_id: null,
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
});
